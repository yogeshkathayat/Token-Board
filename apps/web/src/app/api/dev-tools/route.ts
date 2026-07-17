import { readFile, readdir } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

interface Agent {
  name: string;
  description: string;
  filename: string;
}

interface Skill {
  name: string;
  description: string;
  trigger: string;
}

interface DevToolsResponse {
  agents: Agent[];
  skills: Skill[];
}

/**
 * Parse YAML frontmatter from markdown content
 * Returns the parsed key-value pairs from the frontmatter section
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {};
  }

  const frontmatterContent = match[1];
  const result: Record<string, string> = {};

  // Parse YAML-like key: value pairs
  const lines = frontmatterContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

/**
 * Read and parse agent files from .claude/agents/*.md
 */
async function getAgents(): Promise<Agent[]> {
  const agentsDir = path.join(process.cwd(), '.claude', 'agents');
  const agents: Agent[] = [];

  try {
    const files = await readdir(agentsDir);
    const mdFiles = files.filter((file) => file.endsWith('.md'));

    for (const filename of mdFiles) {
      try {
        const filePath = path.join(agentsDir, filename);
        const content = await readFile(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        agents.push({
          name: frontmatter.name || filename.replace('.md', ''),
          description: frontmatter.description || '',
          filename,
        });
      } catch {
        // Skip files that can't be read
        continue;
      }
    }
  } catch {
    // Return empty array if agents directory doesn't exist
    return [];
  }

  return agents;
}

/**
 * Read and parse skill files from .claude/skills/{skill-name}/SKILL.md
 */
async function getSkills(): Promise<Skill[]> {
  const skillsDir = path.join(process.cwd(), '.claude', 'skills');
  const skills: Skill[] = [];

  try {
    const directories = await readdir(skillsDir, { withFileTypes: true });
    const skillDirs = directories.filter((dirent) => dirent.isDirectory());

    for (const dir of skillDirs) {
      try {
        const skillFilePath = path.join(skillsDir, dir.name, 'SKILL.md');
        const content = await readFile(skillFilePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        // Derive trigger from directory name (e.g., "commit" -> "/commit")
        const trigger = `/${dir.name}`;

        skills.push({
          name: frontmatter.name || dir.name,
          description: frontmatter.description || '',
          trigger,
        });
      } catch {
        // Skip skill directories without SKILL.md or that can't be read
        continue;
      }
    }
  } catch {
    // Return empty array if skills directory doesn't exist
    return [];
  }

  return skills;
}

export async function GET() {
  try {
    const [agents, skills] = await Promise.all([getAgents(), getSkills()]);

    const response: DevToolsResponse = {
      agents,
      skills,
    };

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching dev tools:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dev tools', agents: [], skills: [] },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
