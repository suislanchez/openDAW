/* Minimal local server to run Basic Pitch via Python */
const express = require('express')
const multer = require('multer')
const cors = require('cors')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())

const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }
})

app.post('/api/convert-to-midi', upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).send('No file')
  const audioPath = req.file.path

  // Assumes python3 and basic-pitch installed in system or venv
  const runner = path.join(__dirname, 'runner.py')
  const py = spawn('python3', [runner, audioPath])

  let stdout = ''
  let stderr = ''
  py.stdout.on('data', d => stdout += d.toString())
  py.stderr.on('data', d => stderr += d.toString())

  py.on('close', code => {
    try {
      fs.unlink(req.file.path, () => {})
    } catch {}
    if (code !== 0) {
      console.error('basic-pitch failed', code, stderr)
      return res.status(500).send('Conversion failed')
    }
    const midiPath = stdout.trim()
    if (!midiPath || !fs.existsSync(midiPath)) return res.status(500).send('No MIDI produced')
    res.setHeader('Content-Type', 'audio/midi')
    res.setHeader('Content-Disposition', 'attachment; filename=output.mid')
    fs.createReadStream(midiPath).pipe(res).on('close', () => {
      try { fs.unlink(midiPath, () => {}) } catch {}
    })
  })
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`Basic Pitch server listening on http://localhost:${port}`))


