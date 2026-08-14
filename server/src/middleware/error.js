export function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
}

export function errorHandler(err, req, res, _next) {
  if (err.code === 11000) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors)[0]?.message || 'Invalid input' });
  }
  console.error('[error]', err);
  return res.status(500).json({ message: err.message || 'Server error' });
}
