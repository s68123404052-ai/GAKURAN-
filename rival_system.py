import sqlite3


def init_rival_db(db_name="game_system.db"):
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rival_series (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_a_id TEXT NOT NULL,
            player_b_id TEXT NOT NULL,
            wins_a INTEGER DEFAULT 0,
            wins_b INTEGER DEFAULT 0,
            matches_played INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            reward_paid INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS player_points (
            player_id TEXT PRIMARY KEY,
            total_points INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()


def give_points(cursor, player_id, points):
    cursor.execute("""
        INSERT INTO player_points (player_id, total_points)
        VALUES (?, ?)
        ON CONFLICT(player_id)
        DO UPDATE SET total_points = total_points + excluded.total_points
    """, (player_id, points))


def record_match_and_update_rival(
    player_1,
    player_2,
    winner_id,
    db_name="game_system.db"
):
    if player_1 == player_2:
        return {
            "success": False,
            "error": "ผู้เล่นทั้งสองต้องไม่ใช่คนเดียวกัน"
        }

    if winner_id not in (player_1, player_2):
        return {
            "success": False,
            "error": "winner_id ต้องเป็นผู้เล่นที่ลงแข่งเท่านั้น"
        }

    p_a, p_b = sorted([player_1, player_2])

    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN")

        cursor.execute("""
            SELECT id, wins_a, wins_b, matches_played, reward_paid
            FROM rival_series
            WHERE player_a_id = ?
              AND player_b_id = ?
              AND status = 'active'
            ORDER BY id DESC
            LIMIT 1
        """, (p_a, p_b))

        series = cursor.fetchone()

        if series is None:
            cursor.execute("""
                INSERT INTO rival_series
                (player_a_id, player_b_id, wins_a, wins_b,
                 matches_played, status, reward_paid)
                VALUES (?, ?, 0, 0, 0, 'active', 0)
            """, (p_a, p_b))

            series_id = cursor.lastrowid
            wins_a = 0
            wins_b = 0
            matches_played = 0
            reward_paid = 0
        else:
            (
                series_id,
                wins_a,
                wins_b,
                matches_played,
                reward_paid
            ) = series

        if winner_id == p_a:
            wins_a += 1
        else:
            wins_b += 1

        matches_played += 1

        logs = []

        # Series จบเมื่อมีคนชนะ 3 ครั้ง
        series_finished = wins_a >= 3 or wins_b >= 3

        if series_finished and reward_paid == 0:
            if wins_a >= 3:
                series_winner = p_a
                series_loser = p_b
            else:
                series_winner = p_b
                series_loser = p_a

            base_bonus = 10
            sweep_bonus = 5 if (
                (wins_a == 3 and wins_b == 0)
                or
                (wins_b == 3 and wins_a == 0)
            ) else 0

            resilience_bonus = 2

            winner_reward = base_bonus + sweep_bonus

            give_points(
                cursor,
                series_winner,
                winner_reward
            )

            give_points(
                cursor,
                series_loser,
                resilience_bonus
            )

            cursor.execute("""
                UPDATE rival_series
                SET wins_a = ?,
                    wins_b = ?,
                    matches_played = ?,
                    status = 'completed',
                    reward_paid = 1
                WHERE id = ?
            """, (
                wins_a,
                wins_b,
                matches_played,
                series_id
            ))

            logs.append(
                f"Series Completed! "
                f"Winner: {series_winner} +{winner_reward} pts "
                f"(Base +{base_bonus}"
                f"{f', Sweep +{sweep_bonus}' if sweep_bonus else ''}). "
                f"Loser: {series_loser} +{resilience_bonus} pts "
                f"(Resilience)."
            )

        else:
            cursor.execute("""
                UPDATE rival_series
                SET wins_a = ?,
                    wins_b = ?,
                    matches_played = ?
                WHERE id = ?
            """, (
                wins_a,
                wins_b,
                matches_played,
                series_id
            ))

            logs.append(
                f"Match recorded. "
                f"Series progress: {wins_a}-{wins_b} "
                f"({matches_played} matches)"
            )

        conn.commit()

        return {
            "success": True,
            "series_id": series_id,
            "p_a": p_a,
            "p_b": p_b,
            "wins_a": wins_a,
            "wins_b": wins_b,
            "matches_played": matches_played,
            "logs": logs
        }

    except Exception as e:
        conn.rollback()

        return {
            "success": False,
            "error": str(e)
        }

    finally:
        conn.close()
