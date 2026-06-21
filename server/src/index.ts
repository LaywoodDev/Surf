import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth'
import chatsRoutes from './routes/chats'
import foldersRoutes from './routes/folders'
import usersRoutes from './routes/users'
import aiRoutes from './routes/ai'
import pollsRoutes from './routes/polls'
import { authMiddleware } from './middleware/auth'
import db from './db'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  }
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

app.post('/api/upload/avatar', authMiddleware, upload.single('avatar'), (req: any, res: any) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.userId)
  res.json({ avatar: url })
})

app.post('/api/upload/file', authMiddleware, upload.single('file'), (req: any, res: any) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const url = `/uploads/${req.file.filename}`
  const type = req.file.mimetype.startsWith('image/') ? 'image' : 'document'
  res.json({ url, type })
})

app.use('/api/auth', authRoutes)
app.use('/api/chats', chatsRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/polls', pollsRoutes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
