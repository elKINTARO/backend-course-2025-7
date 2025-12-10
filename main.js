const { Command } = require('commander');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const program = new Command();

program
  .requiredOption('-H, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();

if (!fs.existsSync(options.cache)) { //cтворення директорії для кешy якщо її нема
  fs.mkdirSync(options.cache, { recursive: true });
  console.log(`Директорію кеша створено: ${options.cache}`);
}

const app = express(); //ініціалізація експерса

const swaggerOptions = { //конфігурація свагера
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Laba 6 Invent API',
      version: '1.0.0',
      description: 'API для  інвентаризації',
      contact: {
        name: 'Kiruxa',
        email: 'fedotovpoliyt@gmail.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'server'
      }
    ],
    tags: [
      {
        name: 'Inventory',
        description: 'Інвентар'
      },
      {
        name: 'Forms',
        description: 'Форми'
      },
      {
        name: 'Search',
        description: 'Пошук'
      }
    ]
  },
  apis: ['./main.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json()); //мідлвари для парсингу тіла запитіу
app.use(express.urlencoded({ extended: true }));

//налаштування мультер для завантаження файлів
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

//сховище для інвентаря в пам'яті
let inventory = [];
let currentId = 1;


/**
 * @swagger
 * /RegisterForm.html:
 *   get:
 *     tags: [Forms]
 *     summary: Форма для реєстрації предмету
 *     description: Повертає сторінку з формою для реєстрації нового пристрою
 *     responses:
 *       200:
 *         description: Форма
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */

//гет /RegisterForm.html для реєстр форми
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

/**
 * @swagger
 * /SearchForm.html:
 *   get:
 *     tags: [Forms]
 *     summary: Форма для пошуку пристрою
 *     description: Повертає сторінку з формою для пошуку пристрою за ID
 *     responses:
 *       200:
 *         description: Форма
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */

//гет /SearchForm.html для пошук форми
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Унікальний ідентифікатор
 *           example: 1
 *         inventory_name:
 *           type: string
 *           description: Назва пристрою
 *           example: "Laptop Dell"
 *         description:
 *           type: string
 *           description: Опис пристрою
 *           example: "Work laptop with 16GB RAM"
 *         photo_url:
 *           type: string
 *           nullable: true
 *           description: URL для отримання фото
 *           example: "http://localhost:3000/inventory/1/photo"
 */

/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Inventory]
 *     summary: Реєстрація нового пристрою
 *     description: Створює новий запис інвентаря з можливістю завантаження фото
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - inventory_name
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва пристрою (обов'язково)
 *                 example: "Laptop Dell"
 *               description:
 *                 type: string
 *                 description: Опис пристрою
 *                 example: "Work laptop with 16GB RAM"
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фото пристрою
 *     responses:
 *       201:
 *         description: Пристрій успішно зареєстрований
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Inventory item registered successfully"
 *                 item:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Відсутнє обов'язкове поле inventory_name
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Bad Request: inventory_name is required"
*/
//пост /register для реєстрації присторою
app.post('/register', upload.single('photo'), (req, res) => {
  const { inventory_name, description } = req.body;

  //перевірочка обов'яз поля
  if (!inventory_name || inventory_name.trim() === '') {
    return res.status(400).send('Не валідний запит: потрібна назва інвентарю');
  }

  //створення нью айтема
  const newItem = {
    id: currentId++,
    inventory_name: inventory_name.trim(),
    description: description || '',
    photo: req.file ? req.file.filename : null
  };

  inventory.push(newItem);

  res.status(201).json({
    message: 'Предмет інвентарю успішно зареєстровано',
    item: newItem
  });
});

/**
 * @swagger
 * /inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: Отримання списку всіх інвентаризованих речей
 *     description: Повертає масив всіх зареєстрованих пристроїв з повною інформацією
 *     responses:
 *       200:
 *         description: Список інвентаря
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItem'
 */

//гет /inventory для отримання списку речей
app.get('/inventory', (req, res) => {
  const inventoryList = inventory.map(item => ({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  }));

  res.status(200).json(inventoryList);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     tags: [Inventory]
 *     summary: Отримання інформації про конкретну річ
 *     description: Повертає детальну інформацію про пристрій за його ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Унікальний ідентифікатор пристрою
 *         example: 1
 *     responses:
 *       200:
 *         description: Інформація про пристрій
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Пристрій не знайдено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Not found"
 */

//гет /inventory/id для конкретної речі
app.get('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  res.status(200).json({
    id: item.id,
    inventory_name: item.inventory_name,
    description: item.description,
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  });
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     tags: [Inventory]
 *     summary: Оновлення імені або опису конкретної речі
 *     description: Оновлює інформацію про пристрій (ім'я та/або опис)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Унікальний ідентифікатор пристрою
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Нова назва пристрою
 *                 example: "Laptop Dell XPS"
 *               description:
 *                 type: string
 *                 description: Новий опис пристрою
 *                 example: "Updated description"
 *     responses:
 *       200:
 *         description: Інформація успішно оновлена
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Inventory item updated successfully"
 *                 item:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Пристрій не знайдено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Not found"
 */

//пут /inventory/id для оновленні імені опису речі
app.put('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  const { inventory_name, description } = req.body;

  if (inventory_name !== undefined) {
    item.inventory_name = inventory_name;
  }
  if (description !== undefined) {
    item.description = description;
  }

  res.status(200).json({
    message: 'Інвентаризований предмет успішно оновлено',
    item: {
      id: item.id,
      inventory_name: item.inventory_name,
      description: item.description,
      photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
    }
  });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     tags: [Inventory]
 *     summary: Отримання фото зображення конкретної речі
 *     description: Повертає файл зображення пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Унікальний ідентифікатор пристрою
 *         example: 1
 *     responses:
 *       200:
 *         description: Фото пристрою
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Пристрій або фото не знайдено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Not found"
 */

//гет /inventory/ID/photo для отримання фото
app.get('/inventory/:id/photo', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item || !item.photo) {
    return res.status(404).send('Не знайдено');
  }

  const photoPath = path.join(__dirname, options.cache, item.photo);

  if (!fs.existsSync(photoPath)) {
    return res.status(404).send('Не знайдено');
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.sendFile(photoPath);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     tags: [Inventory]
 *     summary: Оновлення фото зображення конкретної речі
 *     description: Замінює існуюче фото пристрою на нове
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Унікальний ідентифікатор пристрою
 *         example: 1
 *     requestBody:
 *       required: true
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
 *                 description: Нове фото пристрою
 *     responses:
 *       200:
 *         description: Фото успішно оновлено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Photo updated successfully"
 *                 photo_url:
 *                   type: string
 *                   example: "http://localhost:3000/inventory/1/photo"
 *       404:
 *         description: Пристрій не знайдено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Not found"
 */

//пут /inventory/ID/photo для оновлення фото речі
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  //видалення старої фотки якщо вона є
  if (item.photo) {
    const oldPhotoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }

  //апдейт фото
  item.photo = req.file ? req.file.filename : null;

  res.status(200).json({
    message: 'Фото успішно оновлено',
    photo_url: item.photo ? `http://${options.host}:${options.port}/inventory/${item.id}/photo` : null
  });
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     tags: [Inventory]
 *     summary: Видалення інвентаризованої речі зі списку
 *     description: Видаляє пристрій з бази даних та його фото з диску
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Унікальний ідентифікатор пристрою
 *         example: 1
 *     responses:
 *       200:
 *         description: Пристрій успішно видалено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Inventory item deleted successfully"
 *       404:
 *         description: Пристрій не знайдено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Not found"
 */

//делете /inventory/ID для речі
app.delete('/inventory/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const itemIndex = inventory.findIndex(i => i.id === itemId);

  if (itemIndex === -1) {
    return res.status(404).send('Не знайдено');
  }

  const item = inventory[itemIndex];

  //видалення фото при його наявності
  if (item.photo) {
    const photoPath = path.join(options.cache, item.photo);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  //видалення елемента з інвентаря
  inventory.splice(itemIndex, 1);

  res.status(200).json({
    message: 'Інвентаризовну річ іспішно видалено'
  });
});

/**
 * @swagger
 * /search:
 *   post:
 *     tags: [Search]
 *     summary: Обробка запиту пошуку пристрою за ID
 *     description: Шукає пристрій за ID з можливістю додавання посилання на фото в опис
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *                 description: ID пристрою для пошуку
 *                 example: 1
 *               has_photo:
 *                 type: string
 *                 description: Прапорець для додавання посилання на фото в опис
 *                 enum: [on, "true"]
 *                 example: "on"
 *     responses:
 *       200:
 *         description: Пристрій знайдено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 inventory_name:
 *                   type: string
 *                   example: "Laptop Dell"
 *                 description:
 *                   type: string
 *                   example: "Work laptop\n\nPhoto: http://localhost:3000/inventory/1/photo"
 *                 photo_url:
 *                   type: string
 *                   example: "http://localhost:3000/inventory/1/photo"
 *       404:
 *         description: Пристрій не знайдено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Not found"
 */

//пост /search обробка пошуку за айді
app.post('/search', (req, res) => {
  const itemId = parseInt(req.body.id);
  const hasPhoto = req.body.has_photo === 'on' || req.body.has_photo === 'true';

  const item = inventory.find(i => i.id === itemId);

  if (!item) {
    return res.status(404).send('Не знайдено');
  }

  let description = item.description;
  
  //додавання посилання на фото якщо обрано
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
});

//обробка неоголошених методів
app.use((req, res, next) => {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).send('Method not allowed');
  }
  next();
});

//запуск сервера
app.listen(options.port, options.host, () => {
  console.log(`Сервер працює на http://${options.host}:${options.port}/`);
  console.log(`Директорія кешу: ${options.cache}`);
});