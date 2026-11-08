import chalk from "chalk";
import startBot from "./system/connect.js";

console.clear();

console.log(
    chalk.cyanBright.bold(
        "╔════════════════════════════════════════════╗"
    )
);
console.log(
    chalk.cyanBright.bold("║") +
    chalk.magentaBright.bold("          🚀 SANJUBOTS x REYCODEDGTL        ") +
    chalk.cyanBright.bold("║")
);
console.log(
    chalk.cyanBright.bold(
        "╠════════════════════════════════════════════╣"
    )
);
console.log(
    chalk.cyanBright.bold("║") +
    chalk.white(" Status Engine : ") + chalk.greenBright("ONLINE & READY") +
    chalk.cyanBright.bold("            ║")
);
console.log(
    chalk.cyanBright.bold("║") +
    chalk.white(" Framework   : ") + chalk.yellowBright("Baileys v7 (ESM)") +
    chalk.cyanBright.bold("        ║")
);
console.log(
    chalk.cyanBright.bold("║") +
    chalk.white(" Developer   : ") + chalk.cyanBright("ReyZ4YouXGod (PT Legion)") +
    chalk.cyanBright.bold("   ║")
);
console.log(
    chalk.cyanBright.bold(
        "╚════════════════════════════════════════════╝"
    )
);

console.log("");
console.log(chalk.gray("⏳ Menghubungkan sistem ke server WhatsApp..."));
console.log("");

// Memulai sistem koneksi dan bot dari folder system
startBot();
