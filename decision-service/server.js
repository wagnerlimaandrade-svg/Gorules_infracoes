import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZenEngine } from "@gorules/zen-engine";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3001);
const RULE_FILE =
  process.env.RULE_FILE ??
  path.join(__dirname, "rules", "classificacao-infracao.json");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

let engine;
let decision;

function loadDecision() {
  const content = fs.readFileSync(RULE_FILE);

  engine = new ZenEngine();
  decision = engine.createDecision(content);

  console.log(`Decisão carregada: ${RULE_FILE}`);
}

function validateInput(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    errors.push("O corpo da requisição deve ser um objeto JSON.");
    return errors;
  }

  if (!body.infracao) {
    errors.push("O objeto 'infracao' é obrigatório.");
  }

  if (!body.condutor) {
    errors.push("O objeto 'condutor' é obrigatório.");
  }

  const registrada = body.infracao?.velocidadeRegistrada;
  const permitida = body.infracao?.velocidadePermitida;

  if (
    typeof registrada !== "number" ||
    !Number.isFinite(registrada) ||
    registrada < 0
  ) {
    errors.push(
      "'infracao.velocidadeRegistrada' deve ser um número maior ou igual a zero."
    );
  }

  if (
    typeof permitida !== "number" ||
    !Number.isFinite(permitida) ||
    permitida <= 0
  ) {
    errors.push(
      "'infracao.velocidadePermitida' deve ser um número maior que zero."
    );
  }

  if (
    body.condutor?.possuiReincidencia !== undefined &&
    typeof body.condutor.possuiReincidencia !== "boolean"
  ) {
    errors.push(
      "'condutor.possuiReincidencia' deve ser verdadeiro ou falso."
    );
  }

  return errors;
}

app.get("/health", (request, response) => {
  response.status(200).json({
    status: "UP",
    service: "decision-service",
    engine: "ZEN"
  });
});

app.post("/decisions/classificar-infracao", async (request, response) => {
  const errors = validateInput(request.body);

  if (errors.length > 0) {
    return response.status(400).json({
      sucesso: false,
      codigo: "DADOS_INVALIDOS",
      erros: errors
    });
  }

  try {
    const evaluation = await decision.evaluate(request.body);

    return response.status(200).json({
      sucesso: true,
      decisao: evaluation.result
    });
  } catch (error) {
    console.error("Falha ao executar decisão:", error);

    return response.status(500).json({
      sucesso: false,
      codigo: "ERRO_AVALIACAO",
      mensagem: "Não foi possível executar o modelo de decisão."
    });
  }
});

app.use((request, response) => {
  response.status(404).json({
    sucesso: false,
    codigo: "ROTA_NAO_ENCONTRADA",
    mensagem: "Rota não encontrada."
  });
});

loadDecision();

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Decision Service executando na porta ${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} recebido. Encerrando o serviço.`);

  server.close(() => {
    if (engine) {
      engine.dispose();
    }

    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));