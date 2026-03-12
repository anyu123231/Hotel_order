const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const { pool } = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'false' ? false : true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// 测试邮件传输器连接
transporter.verify((error, success) => {
  if (error) {
    console.error('邮件服务配置错误:', error);
  } else {
    console.log('邮件服务配置正常');
  }
});

async function requireAdmin(req, res, next) {
  const adminUserId = req.headers['x-admin-user-id'];
  if (!adminUserId) {
    return res.status(401).json({ message: '未提供管理员用户ID' });
  }
  try {
    const [rows] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [adminUserId]);
    if (rows.length === 0 || !rows[0].is_admin) {
      return res.status(401).json({ message: '不是管理员账号' });
    }
    next();
  } catch (e) {
    console.error('Error checking admin', e);
    res.status(500).json({ message: '管理员校验失败' });
  }
}

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await transporter.verify();
  } catch (e) {
    // 忽略邮箱验证错误，主用途是检查服务是否存活
  }
  res.json({ status: 'ok' });
});

// 发送邮箱验证码
app.post('/api/auth/send-code', async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || !purpose) {
    return res.status(400).json({ message: '邮箱和用途必填' });
  }
  const normalizedPurpose = purpose === 'login' ? 'login' : 'register';

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟有效

  try {
    await pool.query(
      'INSERT INTO email_verification_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)',
      [email, code, normalizedPurpose, expiresAt]
    );

    if (!process.env.SMTP_HOST) {
      console.log(`[dev] email code for ${email}: ${code}`);
    } else {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject:
          normalizedPurpose === 'register'
            ? '酒店客房点单 - 注册验证码'
            : '酒店客房点单 - 登录验证码',
        text: `您的验证码为：${code}，10 分钟内有效。`,
        html: `<p>您的验证码为：<b>${code}</b>，10 分钟内有效。</p>`
      });
    }

    res.json({ message: '验证码已发送，请查收邮箱' });
  } catch (err) {
    console.error('Error sending email code', err);
    res.status(500).json({ message: '发送验证码失败，请稍后重试' });
  }
});

async function verifyEmailCode(email, code, purpose) {
  const [rows] = await pool.query(
    'SELECT id, expires_at, used FROM email_verification_codes WHERE email = ? AND code = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
    [email, code, purpose]
  );
  if (rows.length === 0) {
    return false;
  }
  const record = rows[0];
  if (record.used) return false;
  const now = new Date();
  const expiresAt = new Date(record.expires_at);
  if (expiresAt < now) return false;

  await pool.query('UPDATE email_verification_codes SET used = 1 WHERE id = ?', [record.id]);
  return true;
}

// 邮箱验证码注册
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, code } = req.body;
  if (!username || !email || !password || !code) {
    return res.status(400).json({ message: '用户名、邮箱、密码和验证码不能为空' });
  }

  try {
    const [existingUser] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ message: '该用户名或邮箱已被注册' });
    }

    const ok = await verifyEmailCode(email, code, 'register');
    if (!ok) {
      return res.status(400).json({ message: '验证码错误或已失效' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, passwordHash]
    );

    res.status(201).json({ id: result.insertId, username, email });
  } catch (err) {
    console.error('Error registering user', err);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
});

// 登录：支持两种方式（密码登录 / 邮箱验证码登录）
// 密码登录时，前端传入的 email 字段可以填写“邮箱或用户名”，后端都会尝试匹配
app.post('/api/auth/login', async (req, res) => {
  const { email, password, code, loginType } = req.body;
  if (!email) {
    return res.status(400).json({ message: '邮箱或用户名不能为空' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, password_hash, is_admin FROM users WHERE email = ? OR username = ? LIMIT 1',
      [email, email]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: '账号或密码错误' });
    }

    const user = rows[0];

    // 1）密码登录（默认）
    const type = loginType || 'password';
    if (type === 'password') {
      if (!password) {
        return res.status(400).json({ message: '密码不能为空' });
      }
      const okPassword = await bcrypt.compare(password, user.password_hash);
      if (!okPassword) {
        return res.status(400).json({ message: '账号或密码错误' });
      }
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: !!user.is_admin
      });
    }

    // 2）邮箱验证码登录（此时 email 必须是真实邮箱）
    if (type === 'code') {
      if (!code) {
        return res.status(400).json({ message: '验证码不能为空' });
      }
      const okCode = await verifyEmailCode(email, code, 'login');
      if (!okCode) {
        return res.status(400).json({ message: '验证码错误或已失效' });
      }
      return res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: !!user.is_admin
      });
    }

    return res.status(400).json({ message: '不支持的登录方式' });
  } catch (err) {
    console.error('Error logging in', err);
    res.status(500).json({ message: '登录失败，请稍后重试' });
  }
});

// 获取所有可点商品/服务
app.get('/api/items', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, category, description, image_url, available FROM items WHERE available = 1 ORDER BY category, name'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching items', err);
    res.status(500).json({ message: 'Failed to fetch items' });
  }
});

// 创建订单
app.post('/api/orders', async (req, res) => {
  const { roomNumber, guestName, remark, items, userId } = req.body;

  if (!roomNumber || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'roomNumber and items are required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 计算总价
    let totalPrice = 0;
    for (const item of items) {
      if (!item.id || !item.quantity) continue;
      const [rows] = await connection.query(
        'SELECT price FROM items WHERE id = ? AND available = 1',
        [item.id]
      );
      if (rows.length === 0) {
        throw new Error(`Item not found or unavailable: ${item.id}`);
      }
      const price = Number(rows[0].price);
      totalPrice += price * Number(item.quantity);
    }

    // 插入订单
    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, room_number, guest_name, remark, total_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [userId || null, roomNumber, guestName || null, remark || null, totalPrice, 'PENDING']
    );
    const orderId = orderResult.insertId;

    // 插入订单明细
    for (const item of items) {
      if (!item.id || !item.quantity) continue;
      const [rows] = await connection.query(
        'SELECT price FROM items WHERE id = ?',
        [item.id]
      );
      const unitPrice = Number(rows[0].price);
      await connection.query(
        'INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.id, item.quantity, unitPrice]
      );
    }

    await connection.commit();
    res.status(201).json({ orderId, totalPrice });
  } catch (err) {
    await connection.rollback();
    console.error('Error creating order', err);
    res.status(500).json({ message: 'Failed to create order' });
  } finally {
    connection.release();
  }
});

// 按房间号获取该房间最近的订单列表（可用于前端查看状态）
app.get('/api/orders', async (req, res) => {
  const { roomNumber } = req.query;
  if (!roomNumber) {
    return res.status(400).json({ message: 'roomNumber is required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, room_number, guest_name, remark, total_price, status, created_at FROM orders WHERE room_number = ? ORDER BY created_at DESC LIMIT 20',
      [roomNumber]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching orders', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

// 按用户获取历史订单
app.get('/api/user/orders', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, room_number, remark, total_price, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching user orders', err);
    res.status(500).json({ message: 'Failed to fetch user orders' });
  }
});

// 按用户+订单获取订单商品明细
app.get('/api/user/order-items', async (req, res) => {
  const { userId, orderId } = req.query;
  if (!userId || !orderId) {
    return res.status(400).json({ message: 'userId and orderId are required' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT oi.id,
              oi.quantity,
              oi.unit_price,
              i.name
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN items i ON oi.item_id = i.id
       WHERE oi.order_id = ? AND (o.user_id IS NULL OR o.user_id = ?)
       ORDER BY oi.id`,
      [orderId, userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching order items', err);
    res.status(500).json({ message: 'Failed to fetch order items' });
  }
});

// 管理员：获取订单详情
app.get('/api/admin/orders/:id/details', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    // 获取订单基本信息
    const [orderRows] = await pool.query(
      'SELECT id, user_id, room_number, guest_name, remark, total_price, status, created_at FROM orders WHERE id = ?',
      [id]
    );
    
    if (orderRows.length === 0) {
      return res.status(404).json({ message: '订单不存在' });
    }
    
    const order = orderRows[0];
    
    // 获取订单商品明细
    const [itemsRows] = await pool.query(
      `SELECT oi.id,
              oi.quantity,
              oi.unit_price,
              i.name,
              i.description
       FROM order_items oi
       JOIN items i ON oi.item_id = i.id
       WHERE oi.order_id = ?
       ORDER BY oi.id`,
      [id]
    );
    
    res.json({
      ...order,
      items: itemsRows
    });
  } catch (err) {
    console.error('Error fetching order details', err);
    res.status(500).json({ message: 'Failed to fetch order details' });
  }
});

// 管理员：获取订单列表（可按状态过滤）
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    let sql =
      'SELECT id, room_number, guest_name, remark, total_price, status, created_at FROM orders';
    const params = [];
    if (status && status !== 'ALL') {
      sql += ' WHERE status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin orders', err);
    res.status(500).json({ message: 'Failed to fetch admin orders' });
  }
});

// 管理员：更新订单状态
app.patch('/api/admin/orders/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['PENDING', 'PREPARING', 'SENT', 'DELIVERED', 'CANCELLED'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: '无效的订单状态' });
  }
  try {
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.json({ id: Number(id), status });
  } catch (err) {
    console.error('Error updating order status', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// 管理员：商品管理
app.get('/api/admin/items', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, category, description, image_url, available FROM items ORDER BY category, name'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching admin items', err);
    res.status(500).json({ message: 'Failed to fetch items' });
  }
});

// 用户资料修改
app.post('/api/user/profile', async (req, res) => {
  const { userId, username, email, currentPassword, newPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ message: 'userId is required' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const user = rows[0];

    // 如果要修改密码或邮箱/用户名，要求提供当前密码
    if ((newPassword || email || username) && !currentPassword) {
      return res.status(400).json({ message: '请提供当前密码以修改资料' });
    }
    if (currentPassword) {
      const ok = await bcrypt.compare(currentPassword, user.password_hash);
      if (!ok) {
        return res.status(400).json({ message: '当前密码不正确' });
      }
    }

    const nextUsername = username || user.username;
    const nextEmail = email || user.email;
    let nextPasswordHash = user.password_hash;
    if (newPassword) {
      nextPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    await pool.query(
      'UPDATE users SET username = ?, email = ?, password_hash = ? WHERE id = ?',
      [nextUsername, nextEmail, nextPasswordHash, userId]
    );

    res.json({ id: userId, username: nextUsername, email: nextEmail });
  } catch (err) {
    console.error('Error updating profile', err);
    res.status(500).json({ message: '更新资料失败，请稍后重试' });
  }
});

app.post('/api/admin/items', requireAdmin, async (req, res) => {
  const { name, price, category, description, image_url, available } = req.body;
  if (!name || !category || price === undefined) {
    return res.status(400).json({ message: '名称、价格、分类必填' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO items (name, price, category, description, image_url, available) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, category, description || null, image_url || null, available ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Error creating item', err);
    res.status(500).json({ message: 'Failed to create item' });
  }
});

app.put('/api/admin/items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, price, category, description, image_url, available } = req.body;
  try {
    await pool.query(
      'UPDATE items SET name = ?, price = ?, category = ?, description = ?, image_url = ?, available = ? WHERE id = ?',
      [
        name,
        price,
        category,
        description || null,
        image_url || null,
        available ? 1 : 0,
        id
      ]
    );
    res.json({ id: Number(id) });
  } catch (err) {
    console.error('Error updating item', err);
    res.status(500).json({ message: 'Failed to update item' });
  }
});

app.delete('/api/admin/items/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM order_items WHERE item_id = ?', [
      id
    ]);
    if (rows[0].cnt > 0) {
      return res
        .status(400)
        .json({ message: '该商品已经有订单记录，不能删除（可改为下架 available=0）' });
    }
    await pool.query('DELETE FROM items WHERE id = ?', [id]);
    res.json({ id: Number(id) });
  } catch (err) {
    console.error('Error deleting item', err);
    res.status(500).json({ message: 'Failed to delete item' });
  }
});

// 静态前端资源（把项目根目录下的 frontend 作为网站根目录）
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// 其它非 /api 请求都返回前端首页
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Not found' });
  }
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Hotel order backend listening on http://localhost:${PORT}`);
});
