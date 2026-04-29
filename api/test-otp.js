module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ message: 'API is reachable!', body: req.body });
};
