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
  permissions: Permissions;
  active: boolean;
}

// Resolve which workspace the caller belongs to.
// Owner = own user id. Staff = the workspace_owner_id from their staff_members row.
export const resolveWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Check if the caller is a staff member of someone else's workspace.
    const { data: staff } = await supabase
      .from("staff_members")
      .select("workspace_owner_id, role, permissions, name, email, id, user_id, active")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (staff) {
      return {
        workspaceOwnerId: staff.workspace_owner_id as string,
        isOwner: staff.workspace_owner_id === userId,
        me: {
          id: staff.id as string,
          userId: staff.user_id as string,
          name: (staff.name as string) ?? "",
          email: (staff.email as string) ?? "",
          role: staff.role as Role,
          permissions: (staff.permissions ?? {}) as Permissions,
          active: !!staff.active,
        } as StaffMemberDTO,
      };
    }
    // No staff row → user owns their own workspace.
    return { workspaceOwnerId: userId, isOwner: true, me: null };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffMemberDTO[]> => {
    const { supabase, userId } = context;
    // Find caller's workspace owner id (see resolveWorkspace).
    const { data: self } = await supabase
      .from("staff_members")
      .select("workspace_owner_id")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const owner = (self?.workspace_owner_id as string) ?? userId;

    const { data, error } = await supabase
      .from("staff_members")
      .select("id, user_id, name, email, role, permissions, active")
      .eq("workspace_owner_id", owner)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      name: (r.name as string) ?? "",
      email: (r.email as string) ?? "",
      role: r.role as Role,
      permissions: (r.permissions ?? {}) as Permissions,
      active: !!r.active,
    }));
  });

export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(1),
        role: ROLE,
        permissions: PERMISSIONS,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ownerId = context.userId;

    // Create the auth user with email pre-confirmed so they can sign in immediately.
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, invited_by: ownerId },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Could not create account");

    const newUserId = created.user.id;

    const { data: sm, error: sErr } = await supabaseAdmin
      .from("staff_members")
      .insert({
        workspace_owner_id: ownerId,
        user_id: newUserId,
        name: data.name,
        email: data.email,
        role: data.role,
        permissions: (data.permissions ?? {}) as never,
        active: true,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: data.role,
      workspace_owner_id: ownerId,
    });

    return {
      id: sm.id as string,
      userId: newUserId,
      name: data.name,
      email: data.email,
      role: data.role,
      permissions: (data.permissions ?? {}) as Permissions,
      active: true,
    } satisfies StaffMemberDTO;
  });

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
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.role !== undefined) patch.role = data.role;
    if (data.permissions !== undefined) patch.permissions = data.permissions ?? {};
    if (data.active !== undefined) patch.active = data.active;
    const { error } = await supabase
      .from("staff_members")
      .update(patch)
      .eq("id", data.id)
      .eq("workspace_owner_id", userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up the row, verifying the caller owns this workspace.
    const { data: row, error: fErr } = await supabaseAdmin
      .from("staff_members")
      .select("user_id, workspace_owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!row || row.workspace_owner_id !== context.userId) throw new Error("Not found");
    // Delete auth account first (cascades to staff row via FK).
    await supabaseAdmin.auth.admin.deleteUser(row.user_id as string);
    return { ok: true };
  });

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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id as string, {
      password: data.newPassword,
    });
    if (error) throw error;
    return { ok: true };
  });
