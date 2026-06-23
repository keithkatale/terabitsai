#!/usr/bin/env node
/**
 * Skills Registry Validator
 * Validates skills-index.yaml against actual skill folder structure
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import YAML from 'yaml';

interface SkillMetadata {
  id: string;
  name: string;
  category: string;
  status: string;
  autonomous: boolean;
  priority: number;
  description: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

async function validateSkillsRegistry(skillsPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Load and parse skills-index.yaml
    const registryPath = join(skillsPath, 'skills-index.yaml');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = YAML.parse(registryContent);

    if (!registry.skills || !Array.isArray(registry.skills)) {
      errors.push('skills-index.yaml must contain a "skills" array');
      return { valid: false, errors, warnings };
    }

    console.log(`✓ Loaded ${registry.skills.length} skills from registry`);

    // 2. Validate each skill entry
    for (const skill of registry.skills) {
      const skillErrors = validateSkillMetadata(skill);
      errors.push(...skillErrors);

      // 3. Check if skill folder exists
      const skillPath = join(skillsPath, skill.category, skill.id);
      try {
        const skillStat = await stat(skillPath);
        if (!skillStat.isDirectory()) {
          errors.push(`${skill.id}: Expected directory at ${skillPath}`);
          continue;
        }

        // 4. Validate SKILL.md exists
        const skillMdPath = join(skillPath, 'SKILL.md');
        try {
          await stat(skillMdPath);
          console.log(`  ✓ ${skill.id}: SKILL.md found`);
        } catch {
          if (skill.status === 'production') {
            errors.push(`${skill.id}: Missing SKILL.md (required for production skills)`);
          } else {
            warnings.push(`${skill.id}: Missing SKILL.md (skill is ${skill.status})`);
          }
        }

        // 5. Check references/ folder (optional but recommended)
        const referencesPath = join(skillPath, 'references');
        try {
          const refStat = await stat(referencesPath);
          if (refStat.isDirectory()) {
            const refFiles = await readdir(referencesPath);
            console.log(`  ✓ ${skill.id}: ${refFiles.length} reference files`);
          }
        } catch {
          if (skill.status === 'production') {
            warnings.push(`${skill.id}: No references/ folder (recommended for production)`);
          }
        }

        // 6. Check scripts/ folder (optional)
        const scriptsPath = join(skillPath, 'scripts');
        try {
          const scriptStat = await stat(scriptsPath);
          if (scriptStat.isDirectory()) {
            const scriptFiles = await readdir(scriptsPath);
            console.log(`  ✓ ${skill.id}: ${scriptFiles.length} script files`);
            
            // Look for execute.ts or similar entry point
            const hasExecutable = scriptFiles.some(f => 
              f.startsWith('execute') || f.startsWith('run') || f.includes(skill.id)
            );
            if (!hasExecutable && skill.status === 'production') {
              warnings.push(`${skill.id}: No obvious entry point script (execute.ts, run.ts, etc.)`);
            }
          }
        } catch {
          if (skill.autonomous && skill.status === 'production') {
            warnings.push(`${skill.id}: No scripts/ folder (recommended for autonomous skills)`);
          }
        }

      } catch {
        if (skill.status === 'production' || skill.status === 'beta') {
          errors.push(`${skill.id}: Folder not found at ${skillPath}`);
        } else {
          warnings.push(`${skill.id}: Folder not found (skill is ${skill.status})`);
        }
      }
    }

    // 7. Check for orphaned skill folders (exist but not in registry)
    const categories = [...new Set(registry.skills.map((s: any) => s.category))];
    for (const category of categories) {
      const categoryPath = join(skillsPath, category);
      try {
        const folders = await readdir(categoryPath);
        for (const folder of folders) {
          const folderStat = await stat(join(categoryPath, folder));
          if (folderStat.isDirectory()) {
            const isRegistered = registry.skills.some((s: any) => 
              s.category === category && s.id === folder
            );
            if (!isRegistered) {
              warnings.push(`Orphaned folder: ${category}/${folder} (not in registry)`);
            }
          }
        }
      } catch {
        // Category folder doesn't exist yet (expected for planned skills)
      }
    }

  } catch (error) {
    errors.push(`Failed to validate registry: ${error}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateSkillMetadata(skill: any): string[] {
  const errors: string[] = [];

  if (!skill.id) errors.push('Skill missing required field: id');
  if (!skill.name) errors.push(`${skill.id}: Missing required field: name`);
  if (!skill.category) errors.push(`${skill.id}: Missing required field: category`);
  if (!skill.status) errors.push(`${skill.id}: Missing required field: status`);
  if (typeof skill.autonomous !== 'boolean') {
    errors.push(`${skill.id}: autonomous must be boolean`);
  }
  if (typeof skill.priority !== 'number') {
    errors.push(`${skill.id}: priority must be number`);
  }
  if (!skill.description) errors.push(`${skill.id}: Missing required field: description`);

  // Validate status enum
  const validStatuses = ['production', 'beta', 'experimental', 'planned'];
  if (skill.status && !validStatuses.includes(skill.status)) {
    errors.push(`${skill.id}: Invalid status "${skill.status}" (must be: ${validStatuses.join(', ')})`);
  }

  // Validate category exists in known categories
  const validCategories = [
    'market-regime',
    'technical-analysis',
    'risk-management',
    'trade-planning',
    'execution-quality',
    'capital-com-specific',
    'knowledge-integration'
  ];
  if (skill.category && !validCategories.includes(skill.category)) {
    errors.push(`${skill.id}: Unknown category "${skill.category}"`);
  }

  return errors;
}

// CLI Execution
async function main() {
  const skillsPath = process.argv[2] || join(process.cwd(), 'skills');

  console.log(`\n🔍 Validating skills registry at: ${skillsPath}\n`);

  const result = await validateSkillsRegistry(skillsPath);

  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION RESULTS');
  console.log('='.repeat(60) + '\n');

  if (result.errors.length > 0) {
    console.log('❌ ERRORS:');
    result.errors.forEach(err => console.log(`  - ${err}`));
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    result.warnings.forEach(warn => console.log(`  - ${warn}`));
    console.log('');
  }

  if (result.valid) {
    console.log('✅ Skills registry is valid!\n');
    process.exit(0);
  } else {
    console.log(`❌ Validation failed with ${result.errors.length} errors\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { validateSkillsRegistry, ValidationResult };
