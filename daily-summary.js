// Serverless function chạy trên Vercel (không lộ ra trình duyệt).
// ANTHROPIC_API_KEY được đọc từ Environment Variables của Vercel, không
// nằm trong code, nên an toàn để deploy public.

const SUPABASE_URL = 'https://txzzgcyvvaiiiukaslqj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4enpnY3l2dmFpaWl1a2FzbHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzg0NjEsImV4cCI6MjEwMDk1NDQ2MX0.WwfBaiE0ePKNOUN-_2tfa5dD3Sj2-9GvJnjk2m320xU';

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase fetch loi: ${path}`);
  return res.json();
}

export default async function handler(req, res) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chưa cấu hình ANTHROPIC_API_KEY trong Vercel Environment Variables.' });
  }

  try {
    const [stock, inbound, summary, orders, forecast] = await Promise.all([
      sb('supply_chain_stock?select=supplier_part_number,product_name,account_stock'),
      sb('inbound?select=stage,qty'),
      sb('inbound_summary?select=stage,units'),
      sb('daily_orders?select=revenue,source,po_date_iso&order=po_date_iso.desc&limit=300'),
      sb('forecast?select=part_number,product_name,current_stock,sales_rate,cycle_index,cycle_label,projected_stock&limit=3000'),
    ]);

    // Nen data lai truoc khi dua vao prompt, tranh gui qua nhieu token
    const latestDate = orders.reduce((max, o) => (o.po_date_iso > max ? o.po_date_iso : max), '');
    const todayOrders = orders.filter(o => o.po_date_iso === latestDate);
    const yesterdayOrders = orders.filter(o => {
      const d = new Date(latestDate);
      d.setDate(d.getDate() - 1);
      return o.po_date_iso === d.toISOString().slice(0, 10);
    });

    const byPart = {};
    forecast.forEach(r => {
      if (!byPart[r.part_number]) {
        byPart[r.part_number] = { product_name: r.product_name, current_stock: r.current_stock, sales_rate: r.sales_rate, cycles: [] };
      }
      byPart[r.part_number].cycles.push(r);
    });
    const stockAlerts = [];
    Object.entries(byPart).forEach(([part, info]) => {
      const hasDemand = info.sales_rate !== null && Number(info.sales_rate) > 0;
      if (!hasDemand) return;
      if (Number(info.current_stock) <= 0) {
        stockAlerts.push(`${info.product_name || part}: đã hết hàng`);
        return;
      }
      info.cycles.sort((a, b) => a.cycle_index - b.cycle_index);
      const stockout = info.cycles.find(c => Number(c.projected_stock) <= 0);
      if (stockout && stockout.cycle_index <= 2) {
        stockAlerts.push(`${info.product_name || part}: hết khoảng ${stockout.cycle_label}`);
      }
    });

    const compact = {
      ngay_gan_nhat: latestDate,
      so_don_hom_nay: todayOrders.length,
      doanh_thu_hom_nay: todayOrders.reduce((a, o) => a + (Number(o.revenue) || 0), 0).toFixed(2),
      so_don_hom_qua: yesterdayOrders.length,
      dropship_hom_nay: todayOrders.filter(o => o.source === 'dropship').length,
      castlegate_hom_nay: todayOrders.filter(o => o.source === 'castlegate').length,
      canh_bao_sap_het_hang: stockAlerts.slice(0, 10),
      tong_hop_san_xuat: summary,
    };

    const prompt = `Bạn là trợ lý vận hành cho một công ty bán đồ gỗ nội thất trên Wayfair (thương hiệu TIDITA/HOLANA). Dựa vào dữ liệu JSON dưới đây, viết một đoạn tóm tắt ngắn gọn bằng tiếng Việt (khoảng 3-5 câu, giọng tự nhiên như đồng nghiệp báo cáo nhanh buổi sáng) cho chủ doanh nghiệp đọc. Tập trung vào điểm nổi bật và điều cần chú ý (nếu có), không liệt kê lại số liệu thô một cách máy móc.

Dữ liệu:
${JSON.stringify(compact)}`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return res.status(500).json({ error: `Anthropic API loi: ${errText}` });
    }

    const claudeData = await claudeRes.json();
    const summaryText = (claudeData.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n');

    return res.status(200).json({ summary: summaryText || 'Không tạo được tóm tắt.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
