import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// Create a poll (also inserts a message)
router.post('/', (req: AuthRequest, res: Response) => {
  const { chatId, question, options } = req.body
  if (!chatId || !question?.trim() || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: 'chatId, question and at least 2 options are required' })
    return
  }

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(chatId, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const poll = db.prepare('INSERT INTO polls (chat_id, question, created_by) VALUES (?, ?, ?)').run(chatId, question.trim(), req.userId)
  const pollId = poll.lastInsertRowid as number

  const insertOption = db.prepare('INSERT INTO poll_options (poll_id, text) VALUES (?, ?)')
  for (const opt of options) {
    if (opt?.trim()) insertOption.run(pollId, opt.trim())
  }

  const msgResult = db.prepare(
    'INSERT INTO messages (chat_id, sender_id, text, poll_id) VALUES (?, ?, ?, ?)'
  ).run(chatId, req.userId, '', pollId)

  const pollOptions = db.prepare('SELECT id, text FROM poll_options WHERE poll_id = ?').all(pollId) as { id: number; text: string }[]

  res.status(201).json({
    pollId,
    messageId: msgResult.lastInsertRowid,
    question: question.trim(),
    options: pollOptions,
    createdBy: req.userId,
  })
})

// Get polls for a chat
router.get('/chat/:chatId', (req: AuthRequest, res: Response) => {
  const { chatId } = req.params

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(chatId, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  const polls = db.prepare('SELECT id, question, created_by as createdBy, created_at as createdAt FROM polls WHERE chat_id = ?').all(chatId) as any[]

  const result = polls.map((poll: any) => {
    const options = db.prepare(`
      SELECT po.id, po.text, COUNT(pv.user_id) as votes
      FROM poll_options po
      LEFT JOIN poll_votes pv ON pv.option_id = po.id
      WHERE po.poll_id = ?
      GROUP BY po.id
    `).all(poll.id) as { id: number; text: string; votes: number }[]

    const totalVotes = db.prepare('SELECT COUNT(*) as count FROM poll_votes WHERE poll_id = ?').get(poll.id) as { count: number }

    const userVote = db.prepare('SELECT option_id as optionId FROM poll_votes WHERE poll_id = ? AND user_id = ?').get(poll.id, req.userId) as { optionId: number } | undefined

    return {
      id: poll.id,
      question: poll.question,
      createdBy: poll.createdBy,
      options: options.map(o => ({ id: o.id, text: o.text, votes: o.votes })),
      totalVotes: totalVotes.count,
      userVote: userVote?.optionId || null,
    }
  })

  res.json(result)
})

// Vote in a poll
router.post('/:pollId/vote', (req: AuthRequest, res: Response) => {
  const { pollId } = req.params
  const { optionId } = req.body
  if (!optionId) {
    res.status(400).json({ error: 'optionId is required' })
    return
  }

  const poll = db.prepare('SELECT chat_id FROM polls WHERE id = ?').get(pollId) as { chat_id: number } | undefined
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' })
    return
  }

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(poll.chat_id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  db.prepare(`
    INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)
    ON CONFLICT(poll_id, user_id) DO UPDATE SET option_id = excluded.option_id
  `).run(pollId, optionId, req.userId)

  const options = db.prepare(`
    SELECT po.id, po.text, COUNT(pv.user_id) as votes
    FROM poll_options po
    LEFT JOIN poll_votes pv ON pv.option_id = po.id
    WHERE po.poll_id = ?
    GROUP BY po.id
  `).all(pollId) as { id: number; text: string; votes: number }[]

  const totalVotes = db.prepare('SELECT COUNT(*) as count FROM poll_votes WHERE poll_id = ?').get(pollId) as { count: number }

  res.json({
    options: options.map(o => ({ id: o.id, text: o.text, votes: o.votes })),
    totalVotes: totalVotes.count,
    userVote: optionId,
  })
})

// Delete a poll
router.delete('/:pollId', (req: AuthRequest, res: Response) => {
  const { pollId } = req.params

  const poll = db.prepare('SELECT chat_id, created_by FROM polls WHERE id = ?').get(pollId) as { chat_id: number; created_by: number } | undefined
  if (!poll) {
    res.status(404).json({ error: 'Poll not found' })
    return
  }

  const participant = db.prepare(
    'SELECT 1 FROM chat_participants WHERE chat_id = ? AND user_id = ?'
  ).get(poll.chat_id, req.userId)

  if (!participant) {
    res.status(403).json({ error: 'Not a participant' })
    return
  }

  db.prepare('DELETE FROM polls WHERE id = ?').run(pollId)
  res.json({ success: true })
})

export default router
