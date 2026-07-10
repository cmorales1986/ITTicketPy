import { usuarios } from '@/lib/db/schema';

type UsuarioRow = typeof usuarios.$inferSelect;

export function toPublicUsuario(usuario: UsuarioRow) {
  const { passwordHash: _passwordHash, ...rest } = usuario;
  return rest;
}
