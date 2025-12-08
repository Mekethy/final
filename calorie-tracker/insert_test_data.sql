USE calorie_app;

-- Default user to attach foods to
INSERT INTO users (username)
VALUES ('default_user')
ON DUPLICATE KEY UPDATE username = username;

-- Sample food entries for the default user
INSERT INTO foods (user_id, food_name, calories)
VALUES
(1, 'Apple (medium)', 95),
(1, 'Banana (medium)', 105),
(1, 'Chicken breast 100g', 165);
