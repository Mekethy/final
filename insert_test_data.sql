USE calorie_app;

-- Required login credentials (even if you don’t use login in your app)
INSERT INTO users (username, password)
VALUES ('gold', 'smiths')
ON DUPLICATE KEY UPDATE username = username;

-- Sample foods for user_id = 1
INSERT INTO foods (user_id, food_name, calories)
VALUES
(1, 'Apple (medium)', 95),
(1, 'Banana (medium)', 105),
(1, 'Chicken breast 100g', 165);
