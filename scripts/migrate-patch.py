#!/usr/bin/env python3
"""
Convert top-level MCP server entries (- id: mcp-*) in cordis.patch.yml to
nested entries inside an '- insert:' block so Cordis Loader mounts them.
"""
import sys, os

def migrate(patch_path):
    if not os.path.exists(patch_path):
        print(f"File not found: {patch_path}")
        return

    with open(patch_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if '- insert:' in content:
        print("File already contains '- insert:' blocks.")
        return

    lines = content.splitlines()
    header_lines = []
    entry_lines = []
    in_entries = False

    for line in lines:
        if line.startswith('- id:') or in_entries:
            in_entries = True
            entry_lines.append(line)
        else:
            header_lines.append(line)

    indented_entries = []
    for line in entry_lines:
        if line.strip() == '':
            indented_entries.append('')
        else:
            indented_entries.append('    ' + line)

    header = '\n'.join(header_lines).rstrip()
    body = '\n'.join(indented_entries).rstrip()
    new_content = header + '\n\n- insert:\n    - id: mcp-admin\n      name: dsh-plugin-mcp-toggle\n\n' + body + '\n'

    backup_path = patch_path + '.bak'
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    with open(patch_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Successfully migrated {patch_path} (backup saved to {backup_path})")

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.dsh/profiles/web/cordis.patch.yml')
    migrate(path)
