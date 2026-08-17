import { supabase } from '@/lib/supabaseClient';

const tableMap = {
  Rol: 'roles',
  User: 'profiles',
  Sede: 'sedes',
  Empleado: 'empleados',
  Servicio: 'servicios',
  AsignacionTurno: 'asignacion_turnos',
  Cobro: 'cobros',
  InventarioItem: 'inventario_items',
  InventarioVariante: 'inventario_variantes',
  Documento: 'documentos',
  Asistencia: 'asistencias',
  Egreso: 'egresos',
  Comunicado: 'comunicados',
  Nominas: 'nominas',
  Vacante: 'vacantes',
  SolicitudInventario: 'solicitudes_inventario',
  Rondin: 'rondines',
  ReporteSupervision: 'reportes_supervision'
};

function formatSupabaseError(error) {
  if (!error) return new Error('Error desconocido de Supabase');

  const parts = [error.message, error.details, error.hint, error.code].filter(Boolean);
  const message = parts.length ? parts.join(' | ') : 'Error desconocido de Supabase';
  const wrappedError = new Error(message);
  wrappedError.originalError = error;
  return wrappedError;
}

function getMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

class EntityService {
  constructor(entityName) {
    this.entityName = entityName;
    this.tableName = tableMap[entityName] || entityName.toLowerCase();
  }

  async list(order) {
    let query = supabase.from(this.tableName).select('*');
    if (order) {
      const isDesc = order.startsWith('-');
      const col = isDesc ? order.slice(1) : order;
      const actualCol = col;
      query = query.order(actualCol, { ascending: !isDesc });
    }
    const { data, error } = await query;
    if (error) throw formatSupabaseError(error);
    return data;
  }

  async filter(queryObj, order) {
    let query = supabase.from(this.tableName).select('*');
    if (queryObj) {
      for (const key of Object.keys(queryObj)) {
        const val = queryObj[key];
        if (val !== undefined && val !== null) {
          if (typeof val === 'object' && val !== null) {
            if ('$in' in val) {
              query = query.in(key, val['$in']);
            }
            if ('$gte' in val) {
              query = query.gte(key, val['$gte']);
            }
            if ('$lte' in val) {
              query = query.lte(key, val['$lte']);
            }
          } else {
            query = query.eq(key, val);
          }
        }
      }
    }
    if (order) {
      const isDesc = order.startsWith('-');
      const col = isDesc ? order.slice(1) : order;
      const actualCol = col;
      query = query.order(actualCol, { ascending: !isDesc });
    }
    const { data, error } = await query;
    if (error) throw formatSupabaseError(error);
    return data;
  }

  async create(payload) {
    const { data, error } = await supabase.from(this.tableName).insert(payload).select().single();
    if (error) throw formatSupabaseError(error);

    if (this.entityName === 'Servicio' && data) {
      try {
        const currentMonth = getMonthKey();
        const existingCobros = await sercoApi.entities.Cobro.filter({
          servicio_id: data.id,
          mes: currentMonth,
        });

        if (existingCobros?.length) {
          return data;
        }

        const cobroPayload = {
          servicio_id: data.id,
          servicio_nombre: data.nombre || payload.nombre || '',
          sede_id: data.sede_id ?? payload.sede_id ?? null,
          mes: currentMonth,
          fecha_factura: null,
          fecha_limite_pago: null,
          monto: null,
          estado: 'pendiente',
          fecha_pago: null,
        };

        const createdCobro = await sercoApi.entities.Cobro.create(cobroPayload);
        if (!createdCobro) {
          console.error('No se pudo crear el cobro asociado al servicio:', data.id);
        }
      } catch (cobroError) {
        const message = cobroError instanceof Error ? cobroError.message : String(cobroError);
        console.error('No se pudo crear el cobro asociado al servicio:', message);
      }
    }

    return data;
  }

  async update(id, payload) {
    const { data, error } = await supabase.from(this.tableName).update(payload).eq('id', id).select().single();
    if (error) throw formatSupabaseError(error);
    return data;
  }

  async delete(id) {
    const { error } = await supabase.from(this.tableName).delete().eq('id', id);
    if (error) throw formatSupabaseError(error);
    return true;
  }

  subscribe(callback) {
    const channel = supabase.channel(`public:${this.tableName}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: this.tableName }, () => {
        callback();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const sercoApi = {
  entities: Object.keys(tableMap).reduce((acc, key) => {
    acc[key] = new EntityService(key);
    return acc;
  }, {}),

  users: {
    async inviteUser(email, role) {
      // Simulate invite by creating a skeleton profile record.
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          email,
          role: role || 'user',
          estado: 'active'
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  auth: {
    async me() {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return null;
      
      const user = session.user;
      // Get role and other metadata from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
         
      return {
        id: user.id,
        email: user.email,
        role: profile?.role || 'user',
        sede_id: profile?.sede_ids?.[0] || null,
        sede_ids: profile?.sede_ids || [],
        full_name: profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0],
        nombre: profile?.usuario || user.user_metadata?.username || user.email.split('@')[0],
        estado: profile?.estado || 'active'
      };
    },

    async loginViaEmailPassword(emailOrUsername, password) {
      let email = emailOrUsername;
      if (!emailOrUsername.includes('@')) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('email')
          .or(`usuario.ilike."${emailOrUsername}",full_name.ilike."${emailOrUsername}"`)
          .maybeSingle();

        if (profileErr || !profile?.email) {
          throw new Error("Usuario o correo no encontrado");
        }
        email = profile.email;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },

    async register({ email, password }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'user',
            nombre: email.split('@')[0]
          }
        }
      });
      if (error) throw error;
      return data;
    },

    async logout(redirectUrl) {
      await supabase.auth.signOut();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },

    async resetPasswordRequest(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      return true;
    },

    async resetPassword({ resetToken, newPassword }) {
      // Supabase uses standard access token when redirecting for password reset.
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return true;
    },

    async updateProfile({ email, password, full_name, username, userId }) {
      const updates = {};
      if (password) updates.password = password;
      if (email) updates.email = email;
      
      const meta = {};
      if (username) meta.username = username;
      if (full_name) meta.full_name = full_name;
      
      if (Object.keys(meta).length > 0) {
        updates.data = meta;
      }
      
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
      }

      const profileUpdates = {};
      if (full_name) profileUpdates.full_name = full_name;
      if (username) profileUpdates.usuario = username;

      if (Object.keys(profileUpdates).length > 0 && userId) {
        const { error } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', userId);
        if (error) throw error;
      }
      return true;
    },

    async deleteAccount(userId) {
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (profileErr) throw profileErr;

      await supabase.auth.signOut();
      return true;
    },

    async loginWithProvider(provider, redirectTo) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${redirectTo || '/'}`
        }
      });
      if (error) throw error;
    }
  }
};
