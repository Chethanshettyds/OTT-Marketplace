const Ticket = require('../models/Ticket');

exports.createTicket = async (req, res) => {
  try {
    const { subject, category, message, relatedOrder } = req.body;
    if (!subject || !message) return res.status(400).json({ error: 'Subject and message required' });

    const ticket = await Ticket.create({
      user: req.user._id,
      subject,
      category: category || 'Other',
      relatedOrder: relatedOrder || null,
      messages: [{
        sender: req.user._id,
        senderName: req.user.name,
        senderRole: req.user.role,
        content: message,
      }],
    });

    res.status(201).json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id }).sort({ updatedAt: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('messages.sender', 'name role');
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    // Only owner or admin
    if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.replyTicket = async (req, res) => {
  try {
    const { message, attachments } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (ticket.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate attachments (max 3, max 5MB each)
    const safeAttachments = [];
    if (Array.isArray(attachments)) {
      for (const att of attachments.slice(0, 3)) {
        const sizeBytes = att.data ? Math.ceil((att.data.length * 3) / 4) : 0;
        if (sizeBytes > 5 * 1024 * 1024) continue; // skip oversized
        safeAttachments.push({ filename: att.filename, mimetype: att.mimetype, size: sizeBytes, data: att.data });
      }
    }

    const newMsg = {
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content: message,
      attachments: safeAttachments,
    };

    ticket.messages.push(newMsg);
    if (req.user.role === 'admin') ticket.status = 'in-progress';
    await ticket.save();

    // Emit via socket
    const io = req.app.get('io');
    io.to(`ticket_${ticket._id}`).emit('receive_message', {
      ticketId: ticket._id,
      message: newMsg,
    });

    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().populate('user', 'name email').sort({ updatedAt: -1 });
    res.json({ tickets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ message: 'Ticket deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
