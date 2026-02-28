import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
export default class ArtifactManager {
    cwd;
    records;
    constructor(cwd) {
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
    get(type) {
        if (!this.records.has(type)) {
            this.refresh();
        }
        return this.records.get(type);
    }
    getPayload(type) {
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
        }
        catch {
            return { ...record };
        }
    }
    resolveOpenApiArtifact() {
        const candidates = [
            { path: 'openapi.json', format: 'json' },
            { path: 'openapi.yaml', format: 'yaml' },
            { path: 'openapi.yml', format: 'yaml' }
        ];
        for (const candidate of candidates) {
            const absolutePath = join(this.cwd, candidate.path);
            if (!existsSync(absolutePath))
                continue;
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
    resolveNavigationArtifact() {
        const candidates = [
            { path: 'navigation.manifest.json', format: 'json' },
            { path: 'navigation.json', format: 'json' }
        ];
        for (const candidate of candidates) {
            const absolutePath = join(this.cwd, candidate.path);
            if (!existsSync(absolutePath))
                continue;
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
    summarizeOpenApi(absolutePath, format) {
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
        }
        catch {
            return {};
        }
    }
    summarizeNavigation(absolutePath) {
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
        }
        catch {
            return {};
        }
    }
}
