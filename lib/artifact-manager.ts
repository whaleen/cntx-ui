import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export type ArtifactType = 'openapi' | 'navigation';
export type ArtifactFormat = 'json' | 'yaml';

export interface ArtifactSummary {
  title?: string;
  version?: string;
  routeCount?: number;
  endpointCount?: number;
  stateCount?: number;
  flowCount?: number;
  viewportCount?: number;
}

export interface ArtifactRecord {
  type: ArtifactType;
  filePath: string;
  format: ArtifactFormat;
  exists: boolean;
  summary: ArtifactSummary;
}

export interface ArtifactPayload extends ArtifactRecord {
  parsed?: any;
  raw?: string;
}

export default class ArtifactManager {
  cwd: string;
  records: Map<ArtifactType, ArtifactRecord>;

  constructor(cwd: string) {
    this.cwd = cwd;
    this.records = new Map();
  }

  refresh() {
    const openapi = this.resolveOpenApiArtifact();
    const navigation = this.resolveNavigationArtifact();
    this.records.set('openapi', openapi);
    this.records.set('navigation', navigation);
    return this.list();
  }

  list() {
    if (this.records.size === 0) {
      this.refresh();
    }
    return Array.from(this.records.values());
  }

  get(type: ArtifactType) {
    if (!this.records.has(type)) {
      this.refresh();
    }
    return this.records.get(type);
  }

  getPayload(type: ArtifactType): ArtifactPayload {
    const record = this.get(type);
    if (!record) {
      return {
        type,
        filePath: '',
        format: 'json',
        exists: false,
        summary: {}
      };
    }
    if (!record.exists) {
      return { ...record };
    }

    try {
      const absolutePath = join(this.cwd, record.filePath);
      const raw = readFileSync(absolutePath, 'utf8');
      if (record.format === 'json') {
        return { ...record, parsed: JSON.parse(raw), raw };
      }
      return { ...record, raw };
    } catch {
      return { ...record };
    }
  }

  private resolveOpenApiArtifact(): ArtifactRecord {
    const candidates: Array<{ path: string; format: ArtifactFormat }> = [
      { path: 'openapi.json', format: 'json' },
      { path: 'openapi.yaml', format: 'yaml' },
      { path: 'openapi.yml', format: 'yaml' }
    ];

    for (const candidate of candidates) {
      const absolutePath = join(this.cwd, candidate.path);
      if (!existsSync(absolutePath)) continue;
      const summary = this.summarizeOpenApi(absolutePath, candidate.format);
      return {
        type: 'openapi',
        filePath: candidate.path,
        format: candidate.format,
        exists: true,
        summary
      };
    }

    return {
      type: 'openapi',
      filePath: 'openapi.json',
      format: 'json',
      exists: false,
      summary: {}
    };
  }

  private resolveNavigationArtifact(): ArtifactRecord {
    const candidates: Array<{ path: string; format: ArtifactFormat }> = [
      { path: 'navigation.manifest.json', format: 'json' },
      { path: 'navigation.json', format: 'json' }
    ];

    for (const candidate of candidates) {
      const absolutePath = join(this.cwd, candidate.path);
      if (!existsSync(absolutePath)) continue;
      const summary = this.summarizeNavigation(absolutePath);
      return {
        type: 'navigation',
        filePath: candidate.path,
        format: candidate.format,
        exists: true,
        summary
      };
    }

    return {
      type: 'navigation',
      filePath: 'navigation.manifest.json',
      format: 'json',
      exists: false,
      summary: {}
    };
  }

  private summarizeOpenApi(absolutePath: string, format: ArtifactFormat): ArtifactSummary {
    try {
      const raw = readFileSync(absolutePath, 'utf8');
      if (format === 'json') {
        const parsed = JSON.parse(raw);
        const endpointCount = parsed.paths ? Object.keys(parsed.paths).length : 0;
        return {
          title: parsed.info?.title,
          version: parsed.info?.version,
          endpointCount
        };
      }

      const titleMatch = raw.match(/^\s*title:\s*["']?(.+?)["']?\s*$/m);
      const versionMatch = raw.match(/^\s*version:\s*["']?(.+?)["']?\s*$/m);
      return {
        title: titleMatch?.[1],
        version: versionMatch?.[1]
      };
    } catch {
      return {};
    }
  }

  private summarizeNavigation(absolutePath: string): ArtifactSummary {
    try {
      const parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
      return {
        title: parsed.project?.name || parsed.name,
        version: parsed.version ? String(parsed.version) : undefined,
        routeCount: Array.isArray(parsed.routes) ? parsed.routes.length : 0,
        stateCount: Array.isArray(parsed.states) ? parsed.states.length : 0,
        flowCount: Array.isArray(parsed.flows) ? parsed.flows.length : 0,
        viewportCount: Array.isArray(parsed.viewports) ? parsed.viewports.length : 0
      };
    } catch {
      return {};
    }
  }
}
