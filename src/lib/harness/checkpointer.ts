import fs from "node:fs";
import path from "node:path";
import { MemorySaver } from "@langchain/langgraph";

/**
 * Checkpoints (principe Mia) : l'état du graphe est sauvegardé après chaque étape.
 * MemorySaver persisté dans data/runtime/checkpoints.json : un rapport en attente
 * de validation humaine survit à un redémarrage du serveur.
 */
export class FileSaver extends MemorySaver {
  private file = path.join(process.cwd(), "data", "runtime", "checkpoints.json");

  constructor() {
    super();
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"), (_k, v) =>
        v && typeof v === "object" && "__u8" in v ? new Uint8Array(Buffer.from(v.__u8, "base64")) : v,
      );
      Object.assign(this.storage, raw.storage ?? {});
      Object.assign(this.writes, raw.writes ?? {});
    } catch {
      /* premier démarrage */
    }
  }

  private persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const json = JSON.stringify({ storage: this.storage, writes: this.writes }, (_k, v) =>
      v instanceof Uint8Array ? { __u8: Buffer.from(v).toString("base64") } : v,
    );
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, json);
    fs.renameSync(tmp, this.file);
  }

  override async put(...args: Parameters<MemorySaver["put"]>) {
    const r = await super.put(...args);
    this.persist();
    return r;
  }

  override async deleteThread(threadId: string) {
    await super.deleteThread(threadId);
    this.persist();
  }

  override async putWrites(...args: Parameters<MemorySaver["putWrites"]>) {
    await super.putWrites(...args);
    this.persist();
  }
}

const g = globalThis as unknown as { __c08Saver?: FileSaver };

export function checkpointer(): FileSaver {
  g.__c08Saver ??= new FileSaver();
  return g.__c08Saver;
}
