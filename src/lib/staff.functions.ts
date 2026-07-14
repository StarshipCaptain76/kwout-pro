import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Role, Permissions } from "./permissions";

const ROLE = z.enum(["owner", "manager", "staff"]);
const PERMISSIONS = z.record(z.string(), z.boolean()).optional().nullable();

export interface StaffMemberDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  title: string | null;
  permissions: Permissions;
  active: boolean;
  /** True when the owner can safely reset this staff member's password. False for users who own or work for other workspaces. */
  canResetPassword: boolean;
}

export interface WorkspaceDTO {
  workspaceOwnerId: string;
  businessName: string;
  role: Role;
  isOwner: boolean;
}

// ---------- helpers ----------

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Paginate until we find them or run out. Most workspaces are small.
  let page = 1;
  const perPage = 200;
  const target = email.trim().toLowerCase();
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return { id: match.id };
    if (users.length < perPage) return null;
    page += 1;
    if (page > 50) return null; // safety cap
  }
}

async function countStaffRowsForUser(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("staff_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

// ---------- Resolve current workspace ----------

export const resolveWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Check saved preference.
    const { data: pref } = await supabase
      .from("user_preferences")
      .select("active_workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    const preferred = (pref?.active_workspace_id as string | null) ?? null;

    // 2. Load all active staff rows for this user.
    const { data: rows } = await supabase
      .from("staff_members")
      .select("workspace_owner_id, role, permissions, name, email, id, user_id, active, created_at")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true });

    const list = rows ?? [];
    if (list.length === 0) {
      // No staff row → user owns their own workspace. Backfill an owner row.
      await ensureOwnerStaffInternal(userId);
      return { workspaceOwnerId: userId, isOwner: true, me: null };
    }

    // Pick preferred row if still valid, otherwise oldest.
    const staff =
      (preferred && list.find((r) => r.workspace_owner_id === preferred)) || list[0];

    return {
      workspaceOwnerId: staff.workspace_owner_id as string,
      isOwner: staff.workspace_owner_id === userId,
      me: {
        id: staff.id as string,
        userId: staff.user_id as string,
        name: (staff.name as string) ?? "",
        email: (staff.email as string) ?? "",
        role: staff.role as Role,
        title: ((staff as { title?: string | null }).title ?? null) as string | null,
        permissions: (staff.permissions ?? {}) as Permissions,
        active: !!staff.active,
        canResetPassword: false, // not meaningful for "me"
      } as StaffMemberDTO,
    };
  });

async function ensureOwnerStaffInternal(userId: string): Promise<StaffMemberDTO> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("staff_members")
    .select("id, user_id, name, email, role, permissions, active, title")
    .eq("user_id", userId)
    .eq("workspace_owner_id", userId)
    .maybeSingle();
  if (existing) {
    return {
      id: existing.id as string,
      userId: existing.user_id as string,
      name: (existing.name as string) ?? "",
      email: (existing.email as string) ?? "",
      role: existing.role as Role,
      title: ((existing as { title?: string | null }).title ?? null) as string | null,
      permissions: (existing.permissions ?? {}) as Permissions,
      active: !!existing.active,
      canResetPassword: false,
    };
  }

  const { data: authRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const authUser = authRes?.user;
  const email = authUser?.email ?? "";
  const meta = (authUser?.user_metadata ?? {}) as { name?: string; full_name?: string };
  const name =
    meta.name ||
    meta.full_name ||
    (email ? email.split("@")[0] : "Owner");

  const { data: inserted, error: iErr } = await supabaseAdmin
    .from("staff_members")
    .insert({
      workspace_owner_id: userId,
      user_id: userId,
      name,
      email,
      role: "owner",
      permissions: {} as never,
      active: true,
    })
    .select("id, user_id, name, email, role, permissions, active")
    .single();
  if (iErr || !inserted) {
    console.error("[ensureOwnerStaff] insert failed", iErr);
    throw new Error(iErr?.message ?? "Could not create owner staff row");
  }

  const { data: hasRole } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("workspace_owner_id", userId)
    .maybeSingle();
  if (!hasRole) {
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "owner", workspace_owner_id: userId })
      .then((r) => {
        if (r.error) console.error("[ensureOwnerStaff] user_roles insert failed", r.error);
      });
  }

  return {
    id: inserted.id as string,
    userId: inserted.user_id as string,
    name: (inserted.name as string) ?? "",
    email: (inserted.email as string) ?? "",
    role: inserted.role as Role,
    title: null,
    permissions: (inserted.permissions ?? {}) as Permissions,
    active: !!inserted.active,
    canResetPassword: false,
  };
}

export const ensureOwnerStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ensureOwnerStaffInternal(context.userId));

// ---------- List staff (with canResetPassword flag) ----------

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffMemberDTO[]> => {
    const { supabase, userId } = context;

    // Match resolveWorkspace: prefer active_workspace_id, else oldest active row, else self.
    const { data: pref } = await supabase
      .from("user_preferences")
      .select("active_workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    const preferred = (pref?.active_workspace_id as string | null) ?? null;

    const { data: rows } = await supabase
      .from("staff_members")
      .select("workspace_owner_id, created_at")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true });
    const memberships = (rows ?? []).map((r) => r.workspace_owner_id as string);
    const owner =
      (preferred && memberships.includes(preferred) && preferred) ||
      memberships[0] ||
      userId;

    const { data, error } = await supabase
      .from("staff_members")
      .select("id, user_id, name, email, role, permissions, active, title")
      .eq("workspace_owner_id", owner)
      .order("created_at", { ascending: true });
    if (error) throw error;

    // Enrich with canResetPassword. A user is "workspace-only" (safe to reset)
    // when they hold no other active staff row and don't own another workspace.
    const list = data ?? [];
    const results: StaffMemberDTO[] = [];
    for (const r of list) {
      const uid = r.user_id as string;
      // Never allow resetting your own password from here.
      const isSelf = uid === userId;
      // Never allow resetting the workspace owner's password from staff panel.
      const isOwnerRow = uid === owner;
      let canReset = false;
      if (!isSelf && !isOwnerRow) {
        const count = await countStaffRowsForUser(uid);
        canReset = count <= 1; // only linked to this workspace
      }
      results.push({
        id: r.id as string,
        userId: uid,
        name: (r.name as string) ?? "",
        email: (r.email as string) ?? "",
        role: r.role as Role,
        title: ((r as { title?: string | null }).title ?? null) as string | null,
        permissions: (r.permissions ?? {}) as Permissions,
        active: !!r.active,
        canResetPassword: canReset,
      });
    }
    return results;
  });

// ---------- List my workspaces ----------

export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceDTO[]> => {
    const { supabase, userId } = context;

    // Ensure the owner row exists so a brand-new user still shows up.
    await ensureOwnerStaffInternal(userId).catch(() => {});

    const { data, error } = await supabase
      .from("staff_members")
      .select("workspace_owner_id, role, created_at")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true });
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) return [];

    // Pull business names from company_profile for each workspace.
    const ownerIds = Array.from(new Set(rows.map((r) => r.workspace_owner_id as string)));
    const { data: profiles } = await supabase
      .from("company_profile")
      .select("owner_user_id, company")
      .in("owner_user_id", ownerIds);
    const nameByOwner = new Map<string, string>();
    for (const p of profiles ?? []) {
      const owner = p.owner_user_id as string;
      const company = (p.company ?? {}) as { name?: string };
      if (company?.name) nameByOwner.set(owner, company.name);
    }

    return rows.map((r) => {
      const owner = r.workspace_owner_id as string;
      return {
        workspaceOwnerId: owner,
        businessName: nameByOwner.get(owner) || (owner === userId ? "My workspace" : "Workspace"),
        role: r.role as Role,
        isOwner: owner === userId,
      };
    });
  });

// ---------- Switch active workspace ----------

export const setActiveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspaceOwnerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the caller actually has an active staff row in the target workspace.
    const { data: row } = await supabase
      .from("staff_members")
      .select("id")
      .eq("user_id", userId)
      .eq("workspace_owner_id", data.workspaceOwnerId)
      .eq("active", true)
      .maybeSingle();
    if (!row) throw new Error("You don't have access to that workspace");

    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { user_id: userId, active_workspace_id: data.workspaceOwnerId },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return { ok: true as const };
  });

// ---------- Add staff (create or link existing) ----------

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        // Optional — required only when the email doesn't already have an account.
        password: z.string().min(6).optional().nullable(),
        name: z.string().min(1),
        role: ROLE,
        title: z.string().max(80).optional().nullable(),
        permissions: PERMISSIONS,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = context.userId;
    const email = data.email.trim().toLowerCase();

    const existing = await findAuthUserByEmail(email);
    let targetUserId: string;
    let created = false;

    if (existing) {
      // Guard: is this user already a staff member of this workspace?
      const { data: dupe } = await supabaseAdmin
        .from("staff_members")
        .select("id, active")
        .eq("workspace_owner_id", ownerId)
        .eq("user_id", existing.id)
        .maybeSingle();
      if (dupe) {
        if (dupe.active) throw new Error("That user is already a staff member of this workspace.");
        // Reactivate the disabled row instead of inserting a duplicate.
        const { error: uErr } = await supabaseAdmin
          .from("staff_members")
          .update({
            active: true,
            name: data.name,
            email,
            role: data.role,
            permissions: (data.permissions ?? {}) as never,
          } as never)
          .eq("id", dupe.id as string);
        if (uErr) throw new Error(uErr.message);
        await supabaseAdmin.from("user_roles").upsert(
          { user_id: existing.id, role: data.role, workspace_owner_id: ownerId } as never,
          { onConflict: "user_id,workspace_owner_id" } as never,
        );
        return {
          kind: "linked" as const,
          id: dupe.id as string,
          userId: existing.id,
          name: data.name,
          email,
          role: data.role,
          permissions: (data.permissions ?? {}) as Permissions,
          active: true,
        };
      }
      targetUserId = existing.id;
    } else {
      if (!data.password) throw new Error("Password is required for new accounts.");
      const { data: createdRes, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name, invited_by: ownerId },
      });
      if (cErr || !createdRes.user) {
        console.error("[createStaffAccount] createUser failed", cErr);
        throw new Error(cErr?.message ?? "Could not create account");
      }
      targetUserId = createdRes.user.id;
      created = true;
    }

    const { data: sm, error: sErr } = await supabaseAdmin
      .from("staff_members")
      .insert({
        workspace_owner_id: ownerId,
        user_id: targetUserId,
        name: data.name,
        email,
        role: data.role,
        permissions: (data.permissions ?? {}) as never,
        active: true,
      })
      .select()
      .single();
    if (sErr) {
      console.error("[createStaffAccount] staff_members insert failed", sErr);
      if (created) await supabaseAdmin.auth.admin.deleteUser(targetUserId).catch(() => {});
      throw new Error(`Could not add staff row: ${sErr.message}`);
    }

    // Upsert user_role scoped to this workspace (unique on user_id, workspace_owner_id).
    const { error: rErr } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: targetUserId, role: data.role, workspace_owner_id: ownerId } as never,
      { onConflict: "user_id,workspace_owner_id" } as never,
    );
    if (rErr) {
      console.error("[createStaffAccount] user_roles upsert failed", rErr);
      throw new Error(`Added but role grant failed: ${rErr.message}`);
    }

    return {
      kind: created ? ("created" as const) : ("linked" as const),
      id: sm.id as string,
      userId: targetUserId,
      name: data.name,
      email,
      role: data.role,
      permissions: (data.permissions ?? {}) as Permissions,
      active: true,
    };
  });

// ---------- Update staff row ----------

export const updateStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().optional(),
        role: ROLE.optional(),
        permissions: PERMISSIONS,
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: {
      name?: string;
      role?: Role;
      permissions?: Permissions;
      active?: boolean;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.role !== undefined) patch.role = data.role;
    if (data.permissions !== undefined) patch.permissions = (data.permissions ?? {}) as Permissions;
    if (data.active !== undefined) patch.active = data.active;
    const { error } = await supabase
      .from("staff_members")
      .update(patch as never)
      .eq("id", data.id)
      .eq("workspace_owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Remove staff (unlink only — never deletes the auth account) ----------

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: fErr } = await supabaseAdmin
      .from("staff_members")
      .select("user_id, workspace_owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!row || row.workspace_owner_id !== context.userId) throw new Error("Not found");

    const targetUserId = row.user_id as string;
    if (targetUserId === context.userId) {
      throw new Error("You can't remove yourself from your own workspace.");
    }

    // Delete only the staff row for THIS workspace. The user keeps their account
    // and any other workspace memberships they have.
    const { error: dErr } = await supabaseAdmin
      .from("staff_members")
      .delete()
      .eq("id", data.id)
      .eq("workspace_owner_id", context.userId);
    if (dErr) throw dErr;

    // Also drop the role row for this workspace so has_role() no longer matches.
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("workspace_owner_id", context.userId);

    return { ok: true };
  });

// ---------- Reset password (only when user is workspace-only) ----------

export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), newPassword: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: fErr } = await supabaseAdmin
      .from("staff_members")
      .select("user_id, workspace_owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!row || row.workspace_owner_id !== context.userId) throw new Error("Not found");

    const targetUserId = row.user_id as string;
    if (targetUserId === context.userId) {
      throw new Error("Use your account settings to change your own password.");
    }

    // Refuse when this user is a member of, or owns, another workspace.
    const others = await countStaffRowsForUser(targetUserId);
    if (others > 1) {
      throw new Error(
        "This user works for another business on KWOUT too. Ask them to reset their password via Forgot password.",
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: data.newPassword,
    });
    if (error) throw error;
    return { ok: true };
  });
