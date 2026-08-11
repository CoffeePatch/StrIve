CREATE OR REPLACE VIEW user_series_progress_view AS
SELECT 
    ues.user_id, 
    ues.title_key, 
    COUNT(ues.episode_number)::INT AS watched_episodes_count, 
    ct.number_of_episodes AS total_episodes_count, 
    CASE 
        WHEN ct.number_of_episodes > 0 THEN ROUND((COUNT(ues.episode_number)::NUMERIC / ct.number_of_episodes::NUMERIC), 4) 
        ELSE 0.0000 
    END AS completion_ratio, 
    MAX(ues.season_number) AS last_watched_season, 
    MAX(ues.watched_at) AS last_watched_at 
FROM user_episode_states ues 
JOIN catalog_titles ct ON ues.title_key = ct.title_key 
GROUP BY ues.user_id, ues.title_key, ct.number_of_episodes;
