require('dotenv').config({override: true});
const express = require('express');
const path = require('path');
const axios = require('axios');
const db = require('./db');



const app = express();
const PORT = process.env.PORT || 8000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function fetchCalories(foodName) {
  try {
    const lower = foodName.toLowerCase();

    //Detect number + g
    let weightMatch = lower.match(/(\d+)\s*g/);  
    let grams = weightMatch ? parseInt(weightMatch[1]) : null;

    //Remove the weight part from the query before searching USDA
    let cleanQuery = lower.replace(/(\d+)\s*g/, "").trim();

    const response = await axios.get(
      "https://api.nal.usda.gov/fdc/v1/foods/search",
      {
        params: {
          query: cleanQuery,
          api_key: process.env.USDA_API_KEY
        }
      }
    );

    const foods = response.data.foods || [];
    if (foods.length === 0) return 100;

    const getCalories = (food) => {
      const n = food.foodNutrients.find(n =>
        n.nutrientName.toLowerCase().includes("energy") &&
        n.unitName.toLowerCase() === "kcal"
      );
      return n ? Number(n.value) : null;
    };


    const isSimple = cleanQuery.split(" ").length === 1;

    //For single-word queries, prefer category matches such as just banana or just apple instead of apple pie 
    if (isSimple) {
      const categoryMatch = foods.find(f =>
        f.foodCategory &&
        f.foodCategory.toLowerCase().includes("fruit") ||
        f.foodCategory.toLowerCase().includes("meat")
      );
      if (categoryMatch) {
        let baseCalories = getCalories(categoryMatch);
        if (!baseCalories) return 100;
        
        //Change based on weight given
        if (grams) {
          return Math.round(baseCalories * (grams / 100));
        }
        return Math.round(baseCalories);
      }
    }

    // Otherwise use the best description match
    const close = foods.find(f =>
      f.description.toLowerCase().includes(cleanQuery)
    ) || foods[0];

    let baseCalories = getCalories(close);
    if (!baseCalories) return 100;

    // Weight scaling
    if (grams) {
      return Math.round(baseCalories * (grams / 100));
    }

    return Math.round(baseCalories);

  } catch (err) {
    console.error("USDA API error:", err.response?.status, err.response?.data || err.message);
    return 100;
  }
}





//Home page – show today's entries + total
app.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT food_name, calories, created_at
      FROM foods
      WHERE DATE(created_at) = CURDATE()
      ORDER BY created_at DESC
      `
    );

    const total = rows.reduce((sum, row) => sum + row.calories, 0);

    res.render('index', {
      foods: rows,
      totalCalories: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading home page');
  }
});

//About page
app.get('/about', (req, res) => {
  res.render('about');
});

//Add food form
app.get('/add', (req, res) => {
  res.render('add', { error: null });
});

//Handle form submission
app.post('/add', async (req, res) => {
  const { food_name } = req.body;

  if (!food_name || food_name.trim() === '') {
    return res.render('add', { error: 'Please enter a food name.' });
  }

  try {
    const calories = await fetchCalories(food_name.trim());

    //
    await db.query(
      'INSERT INTO foods (user_id, food_name, calories) VALUES (?, ?, ?)',
      [1, food_name.trim(), calories]
    );

    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding food');
  }
});

//Search page
app.get('/search', async (req, res) => {
  const q = req.query.q || '';
  let results = [];

  try {
    if (q) {
      const [rows] = await db.query(
        `
        SELECT food_name, calories, created_at
        FROM foods
        WHERE food_name LIKE ?
        ORDER BY created_at DESC
        `,
        [`%${q}%`]
      );
      results = rows;
    }

    res.render('search', {
      query: q,
      results
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error performing search');
  }
});

//View by day
app.get('/day', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  try {
    const [rows] = await db.query(
      `
      SELECT food_name, calories, created_at
      FROM foods
      WHERE DATE(created_at) = ?
      ORDER BY created_at DESC
      `,
      [date]
    );

    const total = rows.reduce((sum, row) => sum + row.calories, 0);

    res.render('day', {
      date,
      foods: rows,
      totalCalories: total
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading day view');
  }
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.listen(PORT, () => {
  console.log(`Calorie Tracker app listening on port ${PORT}`);
});
