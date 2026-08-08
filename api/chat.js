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
    default:
      throw new Error(`Tool khong ton tai: ${name}`);
  }
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

  const systemPrompt = `Bạn là trợ lý vận hành nội bộ cho một công ty bán đồ gỗ nội thất trên Wayfair (thương hiệu TIDITA/HOLANA/TINAMO). Trả lời bằng tiếng Việt, ngắn gọn, tự nhiên như đồng nghiệp. Luôn dùng tool để tra dữ liệu thật trước khi trả lời, không tự bịa số liệu. Nếu tra không ra thông tin cần thiết, nói rõ là không có dữ liệu thay vì đoán.`;

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
