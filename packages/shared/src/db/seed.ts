import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { eq, sql } from "drizzle-orm";
import { createDb } from "./client";
import { communityCustomFields, communityRoles, permissionRoles, landingTemplates, landingPages, landingSections } from "./schema";
import { templates, defaultSections } from "./seeds/landing-templates";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const seedPermissionRoles = [
  { name: "temporaer", description: "Temporary applicant permissions.", level: 0 },
  { name: "user", description: "Default community user role.", level: 10 },
  { name: "moderator", description: "Can moderate community content.", level: 50 },
  { name: "admin", description: "Full administrative permissions.", level: 80 },
  { name: "superadmin", description: "System owner with full access.", level: 100 }
] as const;

async function run() {
  const db = createDb();

  for (const role of seedPermissionRoles) {
    const existing = await db.select().from(permissionRoles).where(eq(permissionRoles.name, role.name)).limit(1);

    if (existing.length === 0) {
      await db.insert(permissionRoles).values(role);
      console.log(`Inserted permission role: ${role.name}`);
    } else {
      console.log(`Permission role already exists: ${role.name}`);
      await db
        .update(permissionRoles)
        .set({
          description: role.description,
          level: role.level
        })
        .where(eq(permissionRoles.name, role.name));
    }
  }

  const communityRoleDefaults = [
    { name: "Bewerber", description: "Neue Bewerber in der Community.", permissionRole: "temporaer", sortOrder: 10 },
    { name: "Anwaerter", description: "Anwärter während Probephase.", permissionRole: "user", sortOrder: 20 },
    { name: "Mitglied", description: "Aktive Community-Mitglieder.", permissionRole: "user", sortOrder: 30 }
  ] as const;

  for (const role of communityRoleDefaults) {
    const permission = await db
      .select()
      .from(permissionRoles)
      .where(eq(permissionRoles.name, role.permissionRole))
      .limit(1);

    if (permission.length === 0) {
      console.log(`Skipped community role "${role.name}" because permission role was not found.`);
      continue;
    }

    const existing = await db.select().from(communityRoles).where(eq(communityRoles.name, role.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(communityRoles).values({
        name: role.name,
        description: role.description,
        permissionRoleId: permission[0].id,
        sortOrder: role.sortOrder
      });
      console.log(`Inserted community role: ${role.name}`);
    } else {
      await db
        .update(communityRoles)
        .set({
          description: role.description,
          permissionRoleId: permission[0].id,
          sortOrder: role.sortOrder,
          updatedAt: new Date()
        })
        .where(eq(communityRoles.name, role.name));
      console.log(`Community role updated: ${role.name}`);
    }
  }

  const defaultCustomFields = [
    {
      key: "mod_tags",
      label: "Tags",
      inputType: "multiselect_search",
      isDefault: true,
      userCanView: false,
      userCanEdit: false,
      modCanView: true,
      modCanEdit: true,
      sortOrder: 10
    },
    {
      key: "mod_note",
      label: "Moderator-Notiz",
      inputType: "textarea",
      isDefault: true,
      userCanView: false,
      userCanEdit: false,
      modCanView: true,
      modCanEdit: true,
      sortOrder: 20
    }
  ] as const;

  for (const field of defaultCustomFields) {
    const existing = await db
      .select()
      .from(communityCustomFields)
      .where(eq(communityCustomFields.key, field.key))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(communityCustomFields).values(field);
      console.log(`Inserted default custom field: ${field.key}`);
    } else {
      console.log(`Default custom field already exists: ${field.key}`);
    }
  }

  // ─── Landing Page Templates & Default Sections ──────────────────────────
  for (const tmpl of templates) {
    const existing = await db.select().from(landingTemplates).where(eq(landingTemplates.id, tmpl.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(landingTemplates).values(tmpl);
      console.log(`Inserted landing template: ${tmpl.id}`);
    } else {
      await db.update(landingTemplates).set({ name: tmpl.name, description: tmpl.description }).where(eq(landingTemplates.id, tmpl.id));
      console.log(`Updated landing template: ${tmpl.id}`);
    }
  }

  const existingPages = await db.select().from(landingPages).limit(1);
  if (existingPages.length === 0) {
    await db.insert(landingPages).values({
      activeTemplate: "default",
      locale: "en",
      metaTitle: "Build Your Legacy",
      metaDescription: "A competitive multi-game community for serious players."
    });
    console.log("Inserted landing page config (en).");

    for (const section of defaultSections) {
      await db.insert(landingSections).values({
        blockType: section.blockType,
        sortOrder: section.sortOrder,
        visible: section.visible,
        config: section.config,
        content: section.content
      });
    }
    console.log(`Inserted ${defaultSections.length} default landing sections.`);
  } else {
    console.log("Landing page already exists, skipping section seed.");
  }
}

run()
  .then(() => {
    console.log("Seed completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
