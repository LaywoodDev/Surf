import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

export const KIMI_API_KEY = process.env.KIMI_API_KEY || ''
const KIMI_API_BASE = 'https://api.moonshot.cn/v1'

export async function callAI(messages: { role: string; content: string }[]) {
  const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIMI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'kimi-latest',
      messages,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI request failed: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

router.post('/process', async (req: AuthRequest, res: Response) => {
  const { text, history, chatId } = req.body
  if (!text?.trim()) {
    res.status(400).json({ error: 'Text is required' })
    return
  }

  const opusUserId = (db.prepare('SELECT id FROM users WHERE email = ?').get('opus@ai.local') as any)?.id

  if (chatId && opusUserId) {
    const isOpusChat = db.prepare(
      'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
    ).get(chatId, opusUserId)
    if (!isOpusChat) {
      const sub = db.prepare(
        "SELECT id FROM user_subscriptions WHERE user_id = ? AND status = 'active' AND end_date > datetime('now')"
      ).get(req.userId) as any
      if (!sub) {
        res.status(403).json({ error: 'Pro subscription required for Opus in chats' })
        return
      }
    }
  }

  if (!KIMI_API_KEY) {
    res.status(500).json({ error: 'KIMI_API_KEY not configured on server' })
    return
  }

  const userRow = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId) as { name: string } | undefined
  const userName = userRow?.name || 'User'

  const chats = db.prepare(`
    SELECT c.id, c.name
    FROM chats c
    JOIN chat_participants cp ON cp.chat_id = c.id
    WHERE cp.user_id = ?
    ORDER BY c.name ASC
  `).all(req.userId) as { id: number; name: string }[]

  if (chatId) {
    const participant = db.prepare(
      'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
    ).get(chatId, req.userId)
    if (!participant) {
      res.status(403).json({ error: 'Not a participant of this chat' })
      return
    }
    db.prepare('INSERT INTO messages (chat_id, sender_id, text) VALUES (?, ?, ?)')
      .run(chatId, req.userId, text.trim())
  }

  const chatDetails = chats.map(c => {
    const otherUser = db.prepare(`
      SELECT u.name, u.surname, u.username, u.bio
      FROM users u
      JOIN chat_participants cp ON cp.user_id = u.id
      WHERE cp.chat_id = ? AND cp.user_id != ?
    `).get(c.id, req.userId) as { name: string; surname: string; username: string; bio: string } | undefined

    const messages = db.prepare(`
      SELECT m.text, m.created_at, u.name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at DESC
      LIMIT 15
    `).all(c.id) as { text: string; created_at: string; sender_name: string }[]

    return {
      id: c.id,
      name: c.name,
      contact: otherUser ? `${otherUser.name} ${otherUser.surname}`.trim() : 'Unknown',
      username: otherUser?.username || '',
      bio: otherUser?.bio || '',
      recentMessages: messages.reverse(),
    }
  })

  const chatListStr = chatDetails.map(c => {
    let s = `- ID: ${c.id}, Имя: "${c.name}", Контакт: ${c.contact}`
    if (c.username) s += `, @${c.username}`
    if (c.bio) s += `, Bio: "${c.bio}"`
    if (c.recentMessages.length > 0) {
      s += `\n  Последние сообщения:`
      s += c.recentMessages.map(m => `\n    [${m.sender_name}]: ${m.text}`).join('')
    }
    return s
  }).join('\n\n')

  const systemPrompt = `Ты — Opus, умный AI-ассистент в мессенджере. Ты можешь поддерживать разговор на любые темы, отвечать на вопросы, помогать с задачами, анализировать чаты и отправлять сообщения от имени пользователя.

Пользователя зовут "${userName}".

Данные о его чатах:
${chatListStr}

Ты можешь отвечать в двух форматах:

1. Если пользователь просто общается или задаёт вопрос — ответь обычным текстом (не JSON). Просто напиши ответ.

2. Если пользователь просит отправить сообщение — ответь JSON-объектом:
{"action":"send","chats":[{"chatId":number,"correctedText":"исправленный текст"}],"response":"что сделано на русском"}

Правила:
- Понимай сообщения на любом языке (русский, украинский, суржик, английский и т. д.)
- Отвечай дружелюбно и естественно
- Исправляй грамматические и орфографические ошибки если нужно отправить сообщение
- Находи чат по имени контакта (например "мама" → чат с "мама" в названии)
- Если пользователь говорит "всем", "все чаты" или "во все" — отправь исправленное сообщение во ВСЕ чаты из списка
- Ты видишь последние сообщения из чатов — можешь анализировать их и отвечать на вопросы по переписке
- Ты видишь профиль контакта (имя, username, bio) — можешь отвечать на вопросы о человеке`

  try {
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]

    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user') messages.push({ role: 'user', content: msg.text })
        else if (msg.role === 'ai') messages.push({ role: 'assistant', content: msg.text })
      }
    }

    messages.push({ role: 'user', content: text })

    const aiResponse = await callAI(messages)

    let result: any
    try {
      result = JSON.parse(aiResponse)
    } catch {
      result = { action: 'reply', response: aiResponse }
    }

    if (chatId && opusUserId) {
      const responseText = result.response || aiResponse
      db.prepare('INSERT INTO messages (chat_id, sender_id, text) VALUES (?, ?, ?)')
        .run(chatId, opusUserId, responseText)
    }

    if (result.action === 'send' && Array.isArray(result.chats)) {
      for (const chat of result.chats) {
        db.prepare('INSERT INTO messages (chat_id, sender_id, text) VALUES (?, ?, ?)')
          .run(chat.chatId, req.userId, chat.correctedText)
      }

      res.json({
        action: 'send',
        sentTo: result.chats.map((c: any) => ({
          chatId: c.chatId,
          chatName: chats.find(ch => ch.id === c.chatId)?.name || 'Unknown',
          text: c.correctedText,
        })),
        response: result.response,
      })
    } else {
      res.json({
        action: 'reply',
        response: result.response,
      })
    }
  } catch (err: any) {
    console.error('AI processing error:', err)
    res.status(500).json({ error: 'Failed to process request' })
  }
})

export default router
