interface Env {
  DB: D1Database
}

// Grok via AI Gateway (OpenAI compat) - APENAS para formatação de documentos
const GROK = {
  baseURL: 'https://gateway.ai.cloudflare.com/v1/1a481f7cdb7027c30174a692c89cbda1/voither/compat',
  apiKey: 'XAI_API_KEY_PLACEHOLDER',
  cfToken: 'zt8DP3ghvTC-4VIcMHjF0RVOrhn73d9HptuqmmKl',
  model: 'grok/grok-4-1-fast-non-reasoning'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generateDocId(cpf: string, crm: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substr(2, 4)
  const cpfPart = cpf.replace(/\D/g, '').slice(-4)
  const crmPart = crm.replace(/\D/g, '').slice(-4)
  return `DOC-${cpfPart}-${crmPart}-${ts}-${rand}`.toUpperCase()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // ==================== PROFISSIONAL ====================
      
      if (path === '/api/profissional' && method === 'GET') {
        const result = await env.DB.prepare('SELECT * FROM profissional WHERE id = 1').first()
        return json(result || { id: 1, nome: '', crm: '', especialidade: '', instituicao: '' })
      }

      if (path === '/api/profissional' && method === 'PUT') {
        const body = await request.json() as { nome: string; crm: string; especialidade?: string; instituicao?: string }
        if (!body.nome || !body.crm) {
          return json({ error: 'Nome e CRM são obrigatórios' }, 400)
        }

        await env.DB.prepare(`
          INSERT INTO profissional (id, nome, crm, especialidade, instituicao, updated_at)
          VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            nome = excluded.nome,
            crm = excluded.crm,
            especialidade = excluded.especialidade,
            instituicao = excluded.instituicao,
            updated_at = CURRENT_TIMESTAMP
        `).bind(body.nome, body.crm, body.especialidade || '', body.instituicao || '').run()

        return json({ success: true })
      }

      // ==================== STATS ====================
      
      if (path === '/api/stats' && method === 'GET') {
        const [pacientes, transcricoes, analises, completas, documentos] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as count FROM pacientes').first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM transcricoes').first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM analises').first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM analises WHERE status = 'complete'").first(),
          env.DB.prepare('SELECT COUNT(*) as count FROM documentos').first(),
        ])
        return json({
          total_pacientes: (pacientes as { count: number })?.count || 0,
          total_transcricoes: (transcricoes as { count: number })?.count || 0,
          total_analises: (analises as { count: number })?.count || 0,
          analises_completas: (completas as { count: number })?.count || 0,
          total_documentos: (documentos as { count: number })?.count || 0,
        })
      }

      // ==================== PACIENTES ====================

      if (path === '/api/pacientes' && method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT p.*, 
            (SELECT COUNT(*) FROM transcricoes WHERE cpf = p.cpf) as total_transcricoes,
            (SELECT COUNT(*) FROM documentos WHERE paciente_cpf = p.cpf) as total_documentos
          FROM pacientes p ORDER BY p.updated_at DESC
        `).all()
        return json(results)
      }

      if (path === '/api/pacientes' && method === 'POST') {
        const body = await request.json() as { cpf: string; nome: string; data_nascimento?: string }
        const cpf = body.cpf.replace(/\D/g, '')
        if (!cpf || cpf.length !== 11) {
          return json({ error: 'CPF inválido' }, 400)
        }
        if (!body.nome) {
          return json({ error: 'Nome é obrigatório' }, 400)
        }

        const exists = await env.DB.prepare('SELECT cpf FROM pacientes WHERE cpf = ?').bind(cpf).first()
        if (exists) {
          return json({ error: 'Paciente já cadastrado' }, 400)
        }

        await env.DB.prepare(
          'INSERT INTO pacientes (cpf, nome, data_nascimento) VALUES (?, ?, ?)'
        ).bind(cpf, body.nome, body.data_nascimento || null).run()

        return json({ cpf, nome: body.nome })
      }

      const pacienteMatch = path.match(/^\/api\/pacientes\/(\d+)$/)
      if (pacienteMatch && method === 'GET') {
        const cpf = pacienteMatch[1]
        const paciente = await env.DB.prepare('SELECT * FROM pacientes WHERE cpf = ?').bind(cpf).first()
        if (!paciente) {
          return json({ error: 'Paciente não encontrado' }, 404)
        }

        const { results: transcricoes } = await env.DB.prepare(`
          SELECT t.*,
            (SELECT COUNT(*) FROM analises WHERE transcricao_id = t.id) as total_analises,
            (SELECT COUNT(*) FROM analises WHERE transcricao_id = t.id AND status = 'complete') as analises_completas
          FROM transcricoes t WHERE t.cpf = ? ORDER BY t.created_at DESC
        `).bind(cpf).all()

        const { results: documentos } = await env.DB.prepare(
          'SELECT * FROM documentos WHERE paciente_cpf = ? ORDER BY created_at DESC'
        ).bind(cpf).all()

        return json({ paciente, transcricoes, documentos })
      }

      if (pacienteMatch && method === 'DELETE') {
        const cpf = pacienteMatch[1]
        await env.DB.prepare('DELETE FROM analises WHERE transcricao_id IN (SELECT id FROM transcricoes WHERE cpf = ?)').bind(cpf).run()
        await env.DB.prepare('DELETE FROM transcricoes WHERE cpf = ?').bind(cpf).run()
        await env.DB.prepare('DELETE FROM documentos WHERE paciente_cpf = ?').bind(cpf).run()
        await env.DB.prepare('DELETE FROM pacientes WHERE cpf = ?').bind(cpf).run()
        return json({ success: true })
      }

      // ==================== TRANSCRIÇÕES ====================

      if (path === '/api/transcricoes' && method === 'POST') {
        const body = await request.json() as { cpf: string; texto: string; data_consulta?: string; notas?: string }
        const cpf = body.cpf.replace(/\D/g, '')

        if (!cpf || !body.texto) {
          return json({ error: 'CPF e texto são obrigatórios' }, 400)
        }

        const id = generateId()
        await env.DB.prepare(
          'INSERT INTO transcricoes (id, cpf, texto, data_consulta, notas) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, cpf, body.texto, body.data_consulta || null, body.notas || null).run()

        return json({ id, cpf })
      }

      const transcricaoMatch = path.match(/^\/api\/transcricoes\/([^/]+)$/)
      if (transcricaoMatch && method === 'GET') {
        const id = transcricaoMatch[1]
        const transcricao = await env.DB.prepare('SELECT * FROM transcricoes WHERE id = ?').bind(id).first()
        if (!transcricao) {
          return json({ error: 'Transcrição não encontrada' }, 404)
        }

        const { results: analises } = await env.DB.prepare(
          'SELECT * FROM analises WHERE transcricao_id = ? ORDER BY created_at ASC'
        ).bind(id).all()

        return json({ transcricao, analises })
      }

      if (transcricaoMatch && method === 'DELETE') {
        const id = transcricaoMatch[1]
        await env.DB.prepare('DELETE FROM analises WHERE transcricao_id = ?').bind(id).run()
        await env.DB.prepare('DELETE FROM transcricoes WHERE id = ?').bind(id).run()
        return json({ success: true })
      }

      // ==================== ANÁLISES (desabilitado por enquanto) ====================

      if (path === '/api/analises' && method === 'POST') {
        return json({ error: 'Pipeline de análises em manutenção. Use importação de documentos.' }, 503)
      }

      const analiseMatch = path.match(/^\/api\/analises\/([^/]+)$/)
      if (analiseMatch && method === 'GET') {
        const id = analiseMatch[1]
        const analise = await env.DB.prepare('SELECT * FROM analises WHERE id = ?').bind(id).first()
        if (!analise) {
          return json({ error: 'Análise não encontrada' }, 404)
        }
        return json(analise)
      }

      // ==================== DOCUMENTOS ====================

      // POST /api/documentos/format - formatar com Grok para visualização
      if (path === '/api/documentos/format' && method === 'POST') {
        const body = await request.json() as { 
          content: string
          stage: string
          paciente_nome: string
          profissional_nome: string
        }

        const stageNames: Record<string, string> = {
          asl: 'Análise Sistêmica Linguística (ASL)',
          vdlp: '15 Dimensões do Espaço Mental (VDLP)',
          gem: 'Grafo do Espaço-Campo Mental (GEM)',
          narrative: 'Narrativa Fenomenológica',
          soap: 'Nota SOAP Trajetorial'
        }

        const prompt = `Você é um formatador de documentos clínicos. Formate o conteúdo abaixo como Markdown profissional e elegante.

REGRAS:
- Crie cabeçalho com título, paciente, profissional e data
- Use headers (##, ###) para organizar seções
- Use listas, tabelas e citações quando apropriado
- Destaque insights com **negrito** ou > citações
- Se for JSON, extraia e apresente de forma legível e humanizada
- Mantenha tom profissional
- Use separadores (---) entre seções

DOCUMENTO: ${stageNames[body.stage] || body.stage}
PACIENTE: ${body.paciente_nome}
PROFISSIONAL: ${body.profissional_nome}
DATA: ${new Date().toLocaleDateString('pt-BR')}

CONTEÚDO:
${body.content}

Responda APENAS com o Markdown, sem explicações.`

        const response = await fetch(GROK.baseURL + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROK.apiKey}`,
            'cf-aig-authorization': `Bearer ${GROK.cfToken}`
          },
          body: JSON.stringify({
            model: GROK.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 8000
          })
        })

        if (!response.ok) {
          const err = await response.text()
          return json({ error: `Grok error: ${response.status} - ${err}` }, 500)
        }

        const data = await response.json() as { choices: Array<{ message: { content: string } }> }
        const markdown = data.choices[0]?.message?.content || ''

        return json({ markdown })
      }

      // POST /api/documentos - criar documento
      if (path === '/api/documentos' && method === 'POST') {
        const body = await request.json() as { 
          paciente_cpf: string
          tipo: string
          stage?: string
          titulo?: string
          dados: unknown
          markdown?: string
        }

        const cpf = body.paciente_cpf.replace(/\D/g, '')
        if (!cpf) {
          return json({ error: 'CPF do paciente é obrigatório' }, 400)
        }

        const prof = await env.DB.prepare('SELECT crm FROM profissional WHERE id = 1').first() as { crm: string } | null
        const crm = prof?.crm || '000000'

        const id = generateDocId(cpf, crm)
        const titulo = body.titulo || `${body.tipo} - ${body.stage || 'geral'}`

        await env.DB.prepare(
          'INSERT INTO documentos (id, profissional_crm, paciente_cpf, tipo, stage, titulo, dados_json, markdown) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, crm, cpf, body.tipo, body.stage || null, titulo, JSON.stringify(body.dados), body.markdown || null).run()

        return json({ id, paciente_cpf: cpf, titulo })
      }

      // GET /api/documentos/:id
      const documentoMatch = path.match(/^\/api\/documentos\/([^/]+)$/)
      if (documentoMatch && method === 'GET') {
        const id = documentoMatch[1]
        const doc = await env.DB.prepare('SELECT * FROM documentos WHERE id = ?').bind(id).first()
        if (!doc) {
          return json({ error: 'Documento não encontrado' }, 404)
        }
        return json(doc)
      }

      // DELETE /api/documentos/:id
      if (documentoMatch && method === 'DELETE') {
        const id = documentoMatch[1]
        await env.DB.prepare('DELETE FROM documentos WHERE id = ?').bind(id).run()
        return json({ success: true })
      }

      return json({ error: 'Not found' }, 404)

    } catch (err) {
      console.error(err)
      return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
    }
  }
}
