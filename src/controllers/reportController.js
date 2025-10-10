const Order = require('../models/Order');
const Book = require('../models/Book');
const User = require('../models/User');

exports.getAllReports = async (req, res) => {
  try {
    // ===== CORE METRICS =====
    const totalBooks = await Book.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalPaidOrders = await Order.countDocuments({ status: 'paid' });

    // ===== PROFIT & REVENUE (PAID ORDERS ONLY) =====
    const profitData = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'books',
          localField: 'items.book',
          foreignField: '_id',
          as: 'bookDoc'
        }
      },
      { $unwind: '$bookDoc' },
      {
        $project: {
          revenue: { $multiply: ['$items.qty', '$items.price'] },
          cost: { $multiply: ['$items.qty', '$bookDoc.costPrice'] }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$revenue' },
          totalCost: { $sum: '$cost' }
        }
      }
    ]);

    const totalRevenue = profitData[0]?.totalRevenue || 0;
    const totalCost = profitData[0]?.totalCost || 0;
    const totalProfit = totalRevenue - totalCost;
    const avgProfitMargin = totalRevenue > 0 
      ? parseFloat(((totalProfit / totalRevenue) * 100).toFixed(2))
      : 0;

    // ===== ORDERS BY STATUS =====
    const statuses = ['paid', 'pending', 'failed', 'cancelled', 'created'];
    const statusResult = await Order.aggregate([
      { $match: { status: { $in: statuses } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const orderStatus = {};
    statuses.forEach(s => orderStatus[s] = 0);
    statusResult.forEach(item => { orderStatus[item._id] = item.count; });

    // ===== TOP BOOKS BOUGHT (by quantity) =====
    const topBooksBought = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'books',
          localField: 'items.book',
          foreignField: '_id',
          as: 'bookDoc'
        }
      },
      { $unwind: '$bookDoc' },
      {
        $group: {
          _id: { title: '$bookDoc.title', author: '$bookDoc.author' },
          totalQty: { $sum: '$items.qty' },
          totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } }
        }
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, title: '$_id.title', author: '$_id.author', totalQty: 1, totalRevenue: 1 } }
    ]);

    // ===== TOP BOOKS BY PROFIT =====
    const topBooksByProfit = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      { $lookup: { from: 'books', localField: 'items.book', foreignField: '_id', as: 'bookDoc' } },
      { $unwind: '$bookDoc' },
      {
        $project: {
          title: '$bookDoc.title',
          author: '$bookDoc.author',
          qty: '$items.qty',
          revenue: { $multiply: ['$items.qty', '$items.price'] },
          cost: { $multiply: ['$items.qty', '$bookDoc.costPrice'] },
          profit: { 
            $subtract: [
              { $multiply: ['$items.qty', '$items.price'] },
              { $multiply: ['$items.qty', '$bookDoc.costPrice'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: { title: '$title', author: '$author' },
          totalQty: { $sum: '$qty' },
          totalRevenue: { $sum: '$revenue' },
          totalProfit: { $sum: '$profit' }
        }
      },
      { $sort: { totalProfit: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, title: '$_id.title', author: '$_id.author', totalQty: 1, totalRevenue: 1, totalProfit: 1 } }
    ]);

    // ===== CUSTOMER INSIGHTS =====
    const repeatBuyers = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: '$user', orderCount: { $sum: 1 } } },
      { $match: { orderCount: { $gte: 2 } } },
      { $count: 'count' }
    ]);
    const repeatBuyerCount = repeatBuyers[0]?.count || 0;

    // ===== SALES BY LANGUAGE =====
    const languageSales = await Order.aggregate([
      { $match: { status: 'paid' } },
      { $unwind: '$items' },
      { $lookup: { from: 'books', localField: 'items.book', foreignField: '_id', as: 'bookDoc' } },
      { $unwind: '$bookDoc' },
      {
        $group: {
          _id: '$bookDoc.language',
          totalRevenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
          totalProfit: { $sum: { $subtract: [ { $multiply: ['$items.qty', '$items.price'] }, { $multiply: ['$items.qty', '$bookDoc.costPrice'] } ] } },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalProfit: -1 } }
    ]).then(results => 
      results.map(item => ({
        language: item._id || 'Unknown',
        totalRevenue: parseFloat(item.totalRevenue.toFixed(2)),
        totalProfit: parseFloat(item.totalProfit.toFixed(2)),
        totalOrders: item.totalOrders
      }))
    );

    // ===== NEW: TOP BOOKS BY MONTH (LAST 6 MONTHS) =====
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTopBooks = await Order.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: sixMonthsAgo } } },
      { $unwind: '$items' },
      { $lookup: { from: 'books', localField: 'items.book', foreignField: '_id', as: 'bookDoc' } },
      { $unwind: '$bookDoc' },
      {
        $project: {
          yearMonth: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          title: '$bookDoc.title',
          author: '$bookDoc.author',
          qty: '$items.qty',
          revenue: { $multiply: ['$items.qty', '$items.price'] }
        }
      },
      {
        $group: {
          _id: { yearMonth: '$yearMonth', title: '$title', author: '$author' },
          totalQty: { $sum: '$qty' },
          totalRevenue: { $sum: '$revenue' }
        }
      },
      { $sort: { '_id.yearMonth': -1, totalQty: -1 } },
      {
        $group: {
          _id: '$_id.yearMonth',
          books: {
            $push: {
              title: '$_id.title',
              author: '$_id.author',
              totalQty: '$totalQty',
              totalRevenue: '$totalRevenue'
            }
          }
        }
      },
      {
        $project: {
          month: '$_id',
          topBooks: { $slice: ['$books', 5] } // Top 5 per month
        }
      },
      { $sort: { month: -1 } }
    ]);

    // ===== RETURN ALL DATA =====
    res.json({
      // Core counts
      totalBooks,
      totalUsers,
      totalPaidOrders,

      // Financials
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      avgProfitMargin,

      // Breakdowns
      orderStatus,
      topBooksBought,
      topBooksByProfit,
      customerInsights: { totalUsers, repeatBuyers: repeatBuyerCount },
      salesByLanguage: languageSales,
      monthlyTopBooks
    });

  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({ error: 'Failed to generate reports' });
  }
};
