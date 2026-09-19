// Never leak stack traces or internal details to clients.
module.exports = (err, req, res, _next) => {
  console.error(`[${req.method} ${req.originalUrl}]`, err.message)
  if (res.headersSent) return
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
}
