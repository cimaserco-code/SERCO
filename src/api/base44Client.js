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
  Documento: 'documentos',
  Asistencia: 'asistencias'
};

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
      const actualCol = col === 'created_date' ? 'created_at' : col;
      query = query.order(actualCol, { ascending: !isDesc });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async filter(queryObj, order) {
    let query = supabase.from(this.tableName).select('*');
    if (queryObj) {
      for (const key of Object.keys(queryObj)) {
        const val = queryObj[key];
        if (val !== undefined && val !== null) {
          if (typeof val === 'object' && '$in' in val) {
            query = query.in(key, val['$in']);
          } else {
            query = query.eq(key, val);
          }
        }
      }
    }
    if (order) {
      const isDesc = order.startsWith('-');
      const col = isDesc ? order.slice(1) : order;
      const actualCol = col === 'created_date' ? 'created_at' : col;
      query = query.order(actualCol, { ascending: !isDesc });
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async create(payload) {
    const { data, error } = await supabase.from(this.tableName).insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  async update(id, payload) {
    const { data, error } = await supabase.from(this.tableName).update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await supabase.from(this.tableName).delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  subscribe(callback) {
    const channel = supabase.channel(`public:${this.tableName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: this.tableName }, () => {
        callback();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const base44 = {
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
          estado: 'active',
          nombre: email.split('@')[0]
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
        nombre: profile?.nombre || user.user_metadata?.nombre || user.email.split('@')[0],
        estado: profile?.estado || 'active'
      };
    },

    async loginViaEmailPassword(email, password) {
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
