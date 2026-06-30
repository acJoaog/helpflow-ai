#!/usr/bin/env python3
"""
Importa o backlog de user stories (.github/backlog-stories.csv) como issues
no GitHub, criando labels de epic/prioridade/tipo automaticamente.

Pré-requisitos:
  - GitHub CLI instalado e autenticado: https://cli.github.com/
    > gh auth login
  - Rodar este script de dentro do repositório (ele detecta o repo via `gh`)

Uso:
  python scripts/create_backlog_issues.py
  python scripts/create_backlog_issues.py --dry-run   # só mostra o que faria
"""

import argparse
import csv
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / ".github" / "backlog-stories.csv"

EPIC_NAMES = {
    "E1": "Autenticação e multi-tenancy",
    "E2": "Gestão de tickets",
    "E3": "Agente de IA com RAG",
    "E4": "Base de conhecimento",
    "E5": "Cobrança e planos",
    "E6": "Painel web",
    "E7": "App mobile",
    "E8": "Observabilidade e confiabilidade",
    "E9": "Segurança e compliance",
    "E10": "CI/CD e infraestrutura",
}

EPIC_COLORS = {
    "E1": "5319e7", "E2": "1d76db", "E3": "0e8a16", "E4": "0e8a16",
    "E5": "fbca04", "E6": "1d76db", "E7": "1d76db", "E8": "b60205",
    "E9": "b60205", "E10": "5319e7",
}

PRIORITY_COLORS = {"must": "d73a4a", "should": "fbca04", "could": "c5def5"}


def run(cmd: list[str], dry_run: bool) -> None:
    print("  $ " + " ".join(cmd))
    if dry_run:
        return
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Label/issue já existente não deve quebrar o script
        if "already exists" in result.stderr:
            print(f"    (já existe, ignorando)")
            return
        print(f"    ERRO: {result.stderr.strip()}", file=sys.stderr)


def ensure_labels(dry_run: bool) -> None:
    print("\n== Criando labels ==")
    for epic_id, color in EPIC_COLORS.items():
        run(["gh", "label", "create", f"epic:{epic_id}",
             "--description", EPIC_NAMES[epic_id],
             "--color", color, "--force"], dry_run)

    for priority, color in PRIORITY_COLORS.items():
        run(["gh", "label", "create", f"priority:{priority}",
             "--color", color, "--force"], dry_run)

    run(["gh", "label", "create", "type:feature", "--color", "a2eeef", "--force"], dry_run)


def build_body(row: dict) -> str:
    return (
        f"## Story\n\n"
        f"**Como** {row['persona']}\n"
        f"**Eu quero** {row['acao']}\n"
        f"**Para que** {row['beneficio']}\n\n"
        f"## Epic relacionado\n\n"
        f"epic:{row['epic']} — {EPIC_NAMES[row['epic']]}\n\n"
        f"## Critério de aceitação\n\n"
        f"- [ ] {row['criterio']}\n\n"
        f"## Estimativa\n\n"
        f"Pontos: {row['points']}\n\n"
        f"---\n"
        f"_Importado automaticamente de `docs/product-and-backlog.md`._"
    )


def create_issues(dry_run: bool) -> None:
    print("\n== Criando issues ==")
    with CSV_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = f"[{row['id']}] {row['title']}"
            labels = f"epic:{row['epic']},priority:{row['priority']},type:feature"
            run([
                "gh", "issue", "create",
                "--title", title,
                "--body", build_body(row),
                "--label", labels,
            ], dry_run)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                         help="Mostra os comandos sem executar nada")
    args = parser.parse_args()

    if not CSV_PATH.exists():
        print(f"Arquivo não encontrado: {CSV_PATH}", file=sys.stderr)
        sys.exit(1)

    ensure_labels(args.dry_run)
    create_issues(args.dry_run)
    print("\nConcluído.")


if __name__ == "__main__":
    main()
