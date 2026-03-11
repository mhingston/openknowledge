import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const pluginRoot = join(__dirname, '..');

describe('openknowledge scaffolding', () => {
  it('package.json exists with correct name, version, type', () => {
    const pkgPath = join(pluginRoot, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);
    
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('openknowledge');
    expect(pkg.version).toBe('0.0.1');
    expect(pkg.type).toBe('module');
  });

  it('tsconfig.json exists with correct compiler options', () => {
    const tsConfigPath = join(pluginRoot, 'tsconfig.json');
    expect(existsSync(tsConfigPath)).toBe(true);
    
    const tsConfig = JSON.parse(readFileSync(tsConfigPath, 'utf-8'));
    expect(tsConfig.compilerOptions.target).toBe('ES2022');
    expect(tsConfig.compilerOptions.strict).toBe(true);
    expect(tsConfig.compilerOptions.module).toBe('NodeNext');
  });

  it('required directories exist: src/, tests/', () => {
    expect(existsSync(join(pluginRoot, 'src'))).toBe(true);
    expect(existsSync(join(pluginRoot, 'tests'))).toBe(true);
  });

  it('main entry point src/index.ts exists', () => {
    const indexPath = join(pluginRoot, 'src', 'index.ts');
    expect(existsSync(indexPath)).toBe(true);
  });
});
