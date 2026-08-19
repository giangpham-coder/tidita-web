// AI Assistant dung tool-use: Claude tu quyet dinh goi bang nao trong
// Supabase de tra loi cau hoi, thay vi 1 doan tom tat co dinh.

const SUPABASE_URL = 'https://txzzgcyvvaiiiukaslqj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4enpnY3l2dmFpaWl1a2FzbHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzg0NjEsImV4cCI6MjEwMDk1NDQ2MX0.WwfBaiE0ePKNOUN-_2tfa5dD3Sj2-9GvJnjk2m320xU';

async function sbQuery(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase loi khi truy van: ${path}`);
  return res.json();
}

const TOOLS = [
  {
    name: 'get_products',
    description: 'Danh sach san pham goc: SKU, ten tieng Viet, class, ASIN, COGS. Dung de tra ten san pham theo SKU.',
    input_schema: { type: 'object', properties: { sku: { type: 'string', description: 'Loc theo 1 SKU cu the, VD WF-TP00169' } } },
  },
  {
    name: 'get_stock',
    description: 'Ton kho chuoi cung ung theo SKU: ton VN, dang san xuat, tren bien, ton trong account, cho ban.',
    input_schema: { type: 'object', properties: { sku: { type: 'string' } } },
  },
  {
    name: 'get_forecast',
    description: 'Du bao ton kho 10 chu ky (moi chu ky 15 ngay) theo SKU - biet SKU nao sap het hang, luc nao.',
    input_schema: { type: 'object', properties: { sku: { type: 'string' } } },
  },
  {
    name: 'get_pricing',
    description: 'Gia von (COGS), base cost, gia ban le, margin % theo SKU.',
    input_schema: { type: 'object', properties: { sku: { type: 'string' } } },
  },
  {
    name: 'get_inbound',
    description: 'Trang thai san xuat/shipment theo lo: stage (PRODUCTION/SHIPMENT), active date, so luong.',
    input_schema: {
      type: 'object',
      properties: { sku: { type: 'string' }, stage: { type: 'string', description: "'PRODUCTION' hoac 'SHIPMENT'" } },
    },
  },
  {
    name: 'get_inbound_summary',
    description: 'Tong hop toan cong ty: Account Stock / On the Sea / VN Storage / In Production / New Lot (khong theo tung SKU).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_daily_orders',
    description: 'Danh sach don hang theo ngay: revenue, source (dropship/castlegate), item number, quantity. Sap xep moi nhat truoc.',
    input_schema: {
      type: 'object',
      properties: {
        sku: { type: 'string' },
        date: { type: 'string', description: "Loc theo 1 ngay, dang 'YYYY-MM-DD'" },
        limit: { type: 'number', description: 'So dong toi da, mac dinh 200' },
      },
    },
  },
  {
    name: 'get_monthly_sales',
    description: 'Doanh so (quantity, revenue) theo thang cho tung SKU.',
    input_schema: {
      type: 'object',
      properties: { sku: { type: 'string' }, year_month: { type: 'string', description: "vd '2026-07'" } },
    },
  },
  {
    name: 'get_ads',
    description: 'Chi tiet ads theo thang: revenue, orders, spend, cogs tung ASIN/SKU, gom theo product_group.',
    input_schema: {
      type: 'object',
      properties: { month: { type: 'string', description: "dang 'YYYY-MM', vd '2026-07'" } },
    },
  },
  {
    name: 'get_returns',
    description: 'Return/incident theo thang cho tung san pham: so luong return, tien bi tru (deduction).',
    input_schema: {
      type: 'object',
      properties: { month: { type: 'string', description: "dang 'YYYY-MM'" } },
    },
  },
  {
    name: 'get_freight',
    description: 'Chi phi freight theo thang (Transportation + Fulfillment CastleGate).',
    input_schema: {
      type: 'object',
      properties: { month: { type: 'string', description: "dang 'YYYY-MM'" } },
    },
  },
  {
    name: 'get_available_months',
    description: 'Lay danh sach cac thang dang co du lieu profit (ads/return/freight). Goi truoc khi hoi ve 1 thang cu the neu chua chac thang do co du lieu khong.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_profit_summary',
    description: 'Tinh san tong hop profit cho 1 thang: Revenue, Ad Spend, COGS, Freight, Return Deduction, DDA Allowance (4%), Profit cuoi cung, va breakdown theo tung product_group. Day la so DA duoc tinh dung cong thuc chuan (giong tren dashboard), nen dung tool nay thay vi tu cong so tu get_ads/get_returns/get_freight de tranh tinh sai.',
    input_schema: {
      type: 'object',
      properties: { month: { type: 'string', description: "dang 'YYYY-MM', vd '2026-07'. Bo trong de lay thang gan nhat co du lieu." } },
    },
  },
];

async function executeTool(name, input) {
  const enc = encodeURIComponent;
  switch (name) {
    case 'get_products':
      return sbQuery(`products?select=*${input.sku ? `&sku=eq.${enc(input.sku)}` : '&limit=500'}`);
    case 'get_stock':
      return sbQuery(`supply_chain_stock?select=*${input.sku ? `&supplier_part_number=eq.${enc(input.sku)}` : '&limit=500'}`);
    case 'get_forecast':
      return sbQuery(`forecast?select=*${input.sku ? `&part_number=eq.${enc(input.sku)}` : '&limit=500'}`);
    case 'get_pricing':
      return sbQuery(`pricing?select=*${input.sku ? `&supplier_part_number=eq.${enc(input.sku)}` : '&limit=500'}`);
    case 'get_inbound': {
      let q = 'inbound?select=*';
      if (input.sku) q += `&supplier_part_number=eq.${enc(input.sku)}`;
      if (input.stage) q += `&stage=eq.${enc(input.stage)}`;
      return sbQuery(q + '&limit=300');
    }
    case 'get_inbound_summary':
      return sbQuery('inbound_summary?select=*');
    case 'get_daily_orders': {
      let q = 'daily_orders?select=*&order=po_date_iso.desc';
      if (input.sku) q += `&item_number=eq.${enc(input.sku)}`;
      if (input.date) q += `&po_date_iso=eq.${enc(input.date)}`;
      q += `&limit=${input.limit || 200}`;
      return sbQuery(q);
    }
    case 'get_monthly_sales': {
      let q = 'monthly_sales?select=*';
      if (input.sku) q += `&sku=eq.${enc(input.sku)}`;
      if (input.year_month) q += `&year_month=eq.${enc(input.year_month)}`;
      return sbQuery(q + '&limit=500');
    }
    case 'get_ads': {
      let q = 'ads_monthly?select=*';
      if (input.month) q += `&month=eq.${enc(input.month)}`;
      return sbQuery(q + '&limit=500');
    }
    case 'get_returns': {
      let q = 'returns_monthly?select=*';
      if (input.month) q += `&month=eq.${enc(input.month)}`;
      return sbQuery(q + '&limit=500');
    }
    case 'get_freight': {
      let q = 'freight_monthly?select=*';
      if (input.month) q += `&month=eq.${enc(input.month)}`;
      return sbQuery(q + '&limit=200');
    }
    case 'get_available_months': {
      const [ads, returns, freight] = await Promise.all([
        sbQuery('ads_monthly?select=month&limit=1000'),
        sbQuery('returns_monthly?select=month&limit=1000'),
        sbQuery('freight_monthly?select=month&limit=200'),
      ]);
      const months = new Set();
      [...ads, ...returns, ...freight].forEach(r => { if (r.month) months.add(r.month); });
      return { available_months: [...months].sort().reverse() };
    }
    case 'get_profit_summary':
      return computeProfitSummary(input.month);
    default:
      throw new Error(`Tool khong ton tai: ${name}`);
  }
}

async function computeProfitSummary(month) {
  let targetMonth = month;
  if (!targetMonth) {
    const [ads, returns, freight] = await Promise.all([
      sbQuery('ads_monthly?select=month&limit=1000'),
      sbQuery('returns_monthly?select=month&limit=1000'),
      sbQuery('freight_monthly?select=month&limit=200'),
    ]);
    const months = new Set();
    [...ads, ...returns, ...freight].forEach(r => { if (r.month) months.add(r.month); });
    targetMonth = [...months].sort().reverse()[0];
  }
  if (!targetMonth) return { error: 'Khong co du lieu profit cho bat ky thang nao.' };

  const [adsRows, returnRows, freightRows] = await Promise.all([
    sbQuery(`ads_monthly?select=*&month=eq.${encodeURIComponent(targetMonth)}&limit=1000`),
    sbQuery(`returns_monthly?select=*&month=eq.${encodeURIComponent(targetMonth)}&limit=1000`),
    sbQuery(`freight_monthly?select=*&month=eq.${encodeURIComponent(targetMonth)}&limit=200`),
  ]);

  let totalRevenue = 0, totalSpend = 0, totalCogs = 0, totalAdsWsSale = 0;
  const categories = {};
  adsRows.forEach(r => {
    const groupName = r.product_group || r.product_name || 'Khac';
    const revenue = Number(r.revenue) || 0;
    const spend = Number(r.spend) || 0;
    const cogsTotal = Number(r.cogs_total) || 0;
    totalRevenue += revenue;
    totalSpend += spend;
    totalCogs += cogsTotal;
    totalAdsWsSale += Number(r.ads_ws_sale) || 0;
    if (!categories[groupName]) categories[groupName] = { revenue: 0, spend: 0, cogsCost: 0 };
    categories[groupName].revenue += revenue;
    categories[groupName].spend += spend;
    categories[groupName].cogsCost += cogsTotal;
  });

  const totalDeduction = returnRows.reduce((a, r) => a + (Number(r.total_deduction) || 0), 0);
  const totalFreight = freightRows.reduce((a, r) => a + (Number(r.charge_amount) || 0), 0);
  const totalDDA = totalRevenue * 0.04;
  const totalProfit = totalRevenue - totalCogs - totalSpend - totalDeduction - totalFreight - totalDDA;
  const adsPct = totalRevenue > 0 ? (totalAdsWsSale / totalRevenue) * 100 : 0;

  const categoryBreakdown = Object.entries(categories).map(([name, c]) => ({
    product_group: name,
    revenue: Math.round(c.revenue),
    ad_spend: Math.round(c.spend),
    cogs: Math.round(c.cogsCost),
    profit: Math.round(c.revenue - c.cogsCost - c.spend),
  })).sort((a, b) => b.profit - a.profit);

  return {
    month: targetMonth,
    total_ws_sales: Math.round(totalRevenue),
    total_ad_spend: Math.round(totalSpend),
    ads_pct_of_revenue: Math.round(adsPct),
    total_cogs: Math.round(totalCogs),
    total_freight: Math.round(totalFreight),
    total_return_deduction: Math.round(totalDeduction),
    total_dda_allowance_4pct: Math.round(totalDDA),
    total_profit: Math.round(totalProfit),
    profit_margin_pct: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : null,
    category_breakdown: categoryBreakdown,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình ANTHROPIC_API_KEY trong Vercel Environment Variables.' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Thiếu messages.' });
  }

  const systemPrompt = `Bạn là trợ lý vận hành nội bộ cho một công ty bán đồ gỗ nội thất trên Wayfair (thương hiệu TIDITA/HOLANA/TINAMO). Trả lời bằng tiếng Việt, ngắn gọn, tự nhiên như đồng nghiệp.

Nguyên tắc quan trọng:
- Luôn dùng tool để tra dữ liệu thật trước khi trả lời, không tự bịa số liệu.
- Khi hỏi về profit/hiệu suất tổng thể, ƯU TIÊN dùng get_profit_summary (đã tính sẵn đúng công thức) thay vì tự cộng từ get_ads/get_returns/get_freight — tránh tính sai hoặc thiếu khoản nào.
- Khi nhận xét performance, phải KHÁCH QUAN: nêu cả điểm tốt lẫn điểm đáng lo ngại nếu có, không chỉ khen. Nếu 1 con số tệ đi so với kỳ trước hoặc âm, phải nói thẳng, không né tránh.
- Mọi nhận xét phải có số liệu cụ thể đi kèm để chứng minh (VD "margin giảm còn 12% do ad spend tăng", không nói chung chung "tháng này ổn").
- Nếu có nhiều tháng dữ liệu (dùng get_available_months để biết), nên so sánh giữa các tháng khi được hỏi về xu hướng thay vì chỉ nhìn 1 tháng.
- Nếu tra không ra thông tin cần thiết, nói rõ là không có dữ liệu thay vì đoán.`;

  let convo = [...messages];
  const MAX_ROUNDS = 5;

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 800,
          system: systemPrompt,
          tools: TOOLS,
          messages: convo,
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        return res.status(500).json({ error: `Anthropic API lỗi: ${errText}` });
      }

      const data = await claudeRes.json();
      convo.push({ role: 'assistant', content: data.content });

      if (data.stop_reason !== 'tool_use') {
        const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
        return res.status(200).json({ reply: text || 'Không có phản hồi.' });
      }

      const toolResults = [];
      for (const block of data.content) {
        if (block.type !== 'tool_use') continue;
        let resultData;
        try {
          resultData = await executeTool(block.name, block.input || {});
        } catch (err) {
          resultData = { error: err.message };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(resultData).slice(0, 8000),
        });
      }
      convo.push({ role: 'user', content: toolResults });
    }

    return res.status(200).json({ reply: 'Câu hỏi này cần quá nhiều bước tra cứu, thử hỏi cụ thể hơn (VD nêu rõ SKU) nhé.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
