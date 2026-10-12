// The projects posts can belong to. A post's `project` must be one of these
// ids — the content schema is built from this list, so a typo fails the build.

export type ProjectStatus = 'running' | 'building' | 'paused' | 'retired';

export interface Project {
  id: string;
  name: string;
  description: string;
  repo?: string;
  status: ProjectStatus;
}

export const PROJECTS = [
  {
    id: 'weatherpage',
    name: 'weatherpage',
    description:
      'A balcony weather station: readings every five minutes, an archive in SQLite, and rain, cloud, fog and thunder nowcasts trained on weather-service stations.',
    repo: 'https://github.com/dwzg/weatherpage',
    status: 'running',
  },
  {
    id: 'agent-config',
    name: 'agent-config',
    description:
      'Skills, agents and plugins for AI coding, taken from my own projects. Each one exists because something went wrong without it.',
    repo: 'https://github.com/dwzg/agent-config',
    status: 'running',
  },
  {
    id: 'camera-firmware',
    name: 'camera firmware',
    description:
      "An old compact camera's firmware, rebuilt in C function by function and checked against the original in an emulator. The repository is private, because it contains the manufacturer's update file.",
    status: 'building',
  },
  {
    id: 'homepage',
    name: 'homepage',
    description: 'This site. Markdown posts, built with Astro, served as static files from a container.',
    repo: 'https://github.com/dwzg/homepage',
    status: 'running',
  },
] as const satisfies readonly Project[];

export type ProjectId = (typeof PROJECTS)[number]['id'];

export const PROJECT_IDS = PROJECTS.map((p) => p.id) as [ProjectId, ...ProjectId[]];

export function getProject(id: string): Project {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) throw new Error(`Unknown project: ${id}`);
  return project;
}
