const MEMORY_KEY = "global";
const SOURCE_NAME = "ToDo.html";

const DEFAULT_MEMORY = {
  version: 3,
  source: SOURCE_NAME,
  updatedAt: null,
  checked: {},
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return {
    url: url.replace(/\/+$/, ""),
    serviceKey,
  };
}

function getHeaders(serviceKey, extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function getMemoryRow() {
  const { url, serviceKey } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/sg_todo_memory?id=eq.${encodeURIComponent(MEMORY_KEY)}&select=data&limit=1`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: getHeaders(serviceKey),
  });
  if (!res.ok) {
    throw new Error(`Supabase GET failed (${res.status})`);
  }
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0].data) {
    return null;
  }
  return rows[0].data;
}

async function upsertMemoryRow(memory) {
  const { url, serviceKey } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/sg_todo_memory?on_conflict=id`;
  const payload = [
    {
      id: MEMORY_KEY,
      data: memory,
      updated_at: new Date().toISOString(),
    },
  ];
  const res = await fetch(endpoint, {
    method: "POST",
    headers: getHeaders(serviceKey, {
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Supabase UPSERT failed (${res.status})`);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const memory = (await getMemoryRow()) || DEFAULT_MEMORY;
      return res.status(200).json(memory);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const normalized = {
        version: 3,
        source: SOURCE_NAME,
        updatedAt: body.updatedAt || new Date().toISOString(),
        checked: body && typeof body.checked === "object" && body.checked ? body.checked : {},
      };
      await upsertMemoryRow(normalized);
      return res.status(200).json({
        ok: true,
        updatedAt: normalized.updatedAt,
        saved: Object.keys(normalized.checked).length,
      });
    }

    return res.status(405).send("Method not allowed");
  } catch (err) {
    return res.status(500).json({
      error: "memory_api_error",
      detail: String(err && err.message ? err.message : err),
    });
  }
};
