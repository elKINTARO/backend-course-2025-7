require('dotenv').config();
const { Command } = require('commander');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { Pool } = require('pg');

const program = new Command();

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);
const options = program.opts();

//підключення до рostgre
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

//перевірка підкл бд
pool.connect((err, client, release) => {
  if (err) {
    console.error('Помилка підключення до бази даних:', err.stack);
  } else {
    console.log('✅ Успішно підключено до PostgreSQL');
    release();
  }
});

if (!fs.existsSync(options.cache)) {
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`Директорію кеша створено: ${options.cache}`);
}

const app = express();

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Laba 7 Inventory API with Postgre',
      version: '2.0.0',
      description: 'API для інвентаризації',
      contact: {
        name: 'Kiruxa',
        email: 'fedotovpoliyt@gmail.com'
      }
    },
    servers: [
      {
        url: `http://${options.host}:${options.port}`,
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Inventory', description: 'Інвентар' },
      { name: 'Forms', description: 'Форми' },
      { name: 'Search', description: 'Пошук' }
    ]
  },
  apis: ['./main.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, options.cache);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage: storage });

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         inventory_name:
 *           type: string
 *         description:
 *           type: string
 *         photo_url:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /RegisterForm.html:
 *   get:
 *     tags: [Forms]
 *     summary: Форма для реєстрації предмету
 *     responses:
 *       200:
 *         description: HTML форма
 */
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

/**
 * @swagger
 * /SearchForm.html:
 *   get:
 *     tags: [Forms]
 *     summary: Форма для пошуку пристрою
 *     responses:
 *       200:
 *         description: HTML форма
 */
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Inventory]
 *     summary: Реєстрація нового пристрою
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Успішно зареєстровано
 *       400:
 *         description: Помилка валідації
 */
app.post('/register', upload.single('photo'), async (req, res) => {
  const { inventory_name, description } = req.body;

  if (!inventory_name || inventory_name.trim() === '') {
    return res.status(400).send('Не валідний запит: потрібна назва інвентарю');
  }

  try {
    const photoFilename = req.file ? req.file.filename : null;
    
    const result = await pool.query(
      'INSERT INTO inventory (inventory_name, description, photo) VALUES ($1, $2, $3) RETURNING *',
      [inventory_name.trim(), description || '', photoFilename]
    );

    const item = result.rows[0];

    res.status(201).json({
      message: 'Предмет інвентарю успішно зареєстровано',
      item: {
        id: item.id,
        inventory_name: item.inventory_name,
        description: item.description,
        photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null,
        created_at: item.created_at,
        updated_at: item.updated_at
      }
    });
  } catch (err) {
    console.error('Помилка при реєстрації:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: Отримання списку всіх інвентаризованих речей
 *     responses:
 *       200:
 *         description: Список інвентаря
 */
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory ORDER BY id ASC');
    
    const inventoryList = result.rows.map(item => ({
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));

    res.status(200).json(inventoryList);
  } catch (err) {
    console.error('Помилка при отриманні списку:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     tags: [Inventory]
 *     summary: Отримання інформації про конкретну річ
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Інформація про пристрій
 *       404:
 *         description: Не знайдено
 */
app.get('/inventory/:id', async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [itemId]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Не знайдено');
    }

    const item = result.rows[0];

    res.status(200).json({
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null,
      created_at: item.created_at,
      updated_at: item.updated_at
    });
  } catch (err) {
    console.error('Помилка при отриманні елемента:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     tags: [Inventory]
 *     summary: Оновлення імені або опису конкретної речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успішно оновлено
 *       404:
 *         description: Не знайдено
 */
app.put('/inventory/:id', async (req, res) => {
  const itemId = parseInt(req.params.id);
  const { inventory_name, description } = req.body;

  try {
    const checkResult = await pool.query('SELECT * FROM inventory WHERE id = $1', [itemId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).send('Не знайдено');
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (inventory_name !== undefined) {
      updates.push(`inventory_name = $${paramCount++}`);
      values.push(inventory_name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    values.push(itemId);

    const result = await pool.query(
      `UPDATE inventory SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    const item = result.rows[0];

    res.status(200).json({
      message: 'Інвентаризований предмет успішно оновлено',
      item: {
        id: item.id,
        inventory_name: item.inventory_name,
        description: item.description,
        photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null,
        created_at: item.created_at,
        updated_at: item.updated_at
      }
    });
  } catch (err) {
    console.error('Помилка при оновленні:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     tags: [Inventory]
 *     summary: Отримання фото зображення конкретної речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Фото пристрою
 *       404:
 *         description: Не знайдено
 */
app.get('/inventory/:id/photo', async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    const result = await pool.query('SELECT photo FROM inventory WHERE id = $1', [itemId]);
    
    if (result.rows.length === 0 || !result.rows[0].photo) {
      return res.status(404).send('Не знайдено');
    }

    const photoPath = path.join(options.cache, result.rows[0].photo);

    if (!fs.existsSync(photoPath)) {
      return res.status(404).send('Не знайдено');
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(photoPath);
  } catch (err) {
    console.error('Помилка при отриманні фото:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     tags: [Inventory]
 *     summary: Оновлення фото зображення конкретної речі
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photo
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Не знайдено
 */
app.put('/inventory/:id/photo', upload.single('photo'), async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    const result = await pool.query('SELECT photo FROM inventory WHERE id = $1', [itemId]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Не знайдено');
    }

    const oldPhoto = result.rows[0].photo;
    
    if (oldPhoto) {
      const oldPhotoPath = path.join(options.cache, oldPhoto);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }

    const newPhoto = req.file ? req.file.filename : null;
    
    await pool.query('UPDATE inventory SET photo = $1 WHERE id = $2', [newPhoto, itemId]);

    res.status(200).json({
      message: 'Фото успішно оновлено',
      photo_url: newPhoto ? `http://${options.host}:${options.port}/inventory/${itemId}/photo` : null
    });
  } catch (err) {
    console.error('Помилка при оновленні фото:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     tags: [Inventory]
 *     summary: Видалення інвентаризованої речі зі списку
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Успішно видалено
 *       404:
 *         description: Не знайдено
 */
app.delete('/inventory/:id', async (req, res) => {
  const itemId = parseInt(req.params.id);

  try {
    const result = await pool.query('SELECT photo FROM inventory WHERE id = $1', [itemId]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Не знайдено');
    }

    const photo = result.rows[0].photo;
    
    if (photo) {
      const photoPath = path.join(options.cache, photo);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }

    await pool.query('DELETE FROM inventory WHERE id = $1', [itemId]);

    res.status(200).json({
      message: 'Інвентаризовну річ успішно видалено'
    });
  } catch (err) {
    console.error('Помилка при видаленні:', err);
    res.status(500).send('Помилка сервера');
  }
});

/**
 * @swagger
 * /search:
 *   post:
 *     tags: [Search]
 *     summary: Обробка запиту пошуку пристрою за ID
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *               has_photo:
 *                 type: string
 *                 enum: [on, "true"]
 *     responses:
 *       200:
 *         description: Пристрій знайдено
 *       404:
 *         description: Не знайдено
 */
app.post('/search', async (req, res) => {
  const itemId = parseInt(req.body.id);
  const hasPhoto = req.body.has_photo === 'on' || req.body.has_photo === 'true';

  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [itemId]);
    
    if (result.rows.length === 0) {
      return res.status(404).send('Не знайдено');
    }

    const item = result.rows[0];
    let description = item.description;
    
    if (hasPhoto && item.photo) {
      const photoUrl = `http://${options.host}:${options.port}/inventory/${item.id}/photo`;
      description += `\n\nPhoto: ${photoUrl}`;
    }

    res.status(200).json({
      id: item.id,
      inventory_name: item.inventory_name,
      description: description,
      photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    });
  } catch (err) {
    console.error('Помилка при пошуку:', err);
    res.status(500).send('Помилка сервера');
  }
});

app.use((req, res, next) => {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).send('Method not allowed');
  }
  next();
});

app.listen(options.port, options.host, () => {
  console.log(`Сервер працює на http://${options.host}:${options.port}/`);
  console.log(`API документація: http://${options.host}:${options.port}/docs`);
  console.log(`Директорія кешу: ${options.cache}`);
  console.log(`Debugger доступний на порту 9229`);
});

//shutdown
process.on('SIGTERM', async () => {
  console.log("SIGTERM отримано. Закриваємо з'єднання з БД...");
  await pool.end();
  process.exit(0);
});