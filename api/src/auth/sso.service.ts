import { Injectable } from '@nestjs/common';

export interface SsoProfile {
  sub: string;
  email: string;
  name: string;
  mappedRole: 'penguji' | 'peserta' | 'pending';
}

/**
 * SSO OIDC/OAuth2 (Authorization Code). NON-AKTIF sampai env lengkap terisi
 * (SSO_CLIENT_ID/SECRET + authorize/token/userinfo URL + redirect URI).
 * Pemetaan peran dari klaim SSO dapat dikonfigurasi lewat env.
 */
@Injectable()
export class SsoService {
  private cfg() {
    return {
      clientId: process.env.SSO_CLIENT_ID ?? '',
      clientSecret: process.env.SSO_CLIENT_SECRET ?? '',
      authorizeUrl: process.env.SSO_AUTHORIZE_URL ?? '',
      tokenUrl: process.env.SSO_TOKEN_URL ?? '',
      userinfoUrl: process.env.SSO_USERINFO_URL ?? '',
      redirectUri: process.env.SSO_REDIRECT_URI ?? '',
      scope: process.env.SSO_SCOPE ?? 'openid profile email',
      roleClaim: process.env.SSO_ROLE_CLAIM ?? 'role',
      dosenValue: (process.env.SSO_ROLE_DOSEN ?? 'dosen').toLowerCase(),
      mahasiswaValue: (process.env.SSO_ROLE_MAHASISWA ?? 'mahasiswa').toLowerCase(),
      label: process.env.SSO_LABEL ?? 'SSO UNISMUH',
    };
  }

  isEnabled(): boolean {
    const c = this.cfg();
    return Boolean(
      c.clientId &&
        c.clientSecret &&
        c.authorizeUrl &&
        c.tokenUrl &&
        c.userinfoUrl &&
        c.redirectUri,
    );
  }

  /** Mode 1-pintu: login lokal dimatikan utk non-superadmin (efektif saat SSO aktif). */
  ssoOnly(): boolean {
    return process.env.SSO_ONLY_LOGIN === 'true';
  }

  status(): { enabled: boolean; label: string; ssoOnly: boolean } {
    return { enabled: this.isEnabled(), label: this.cfg().label, ssoOnly: this.ssoOnly() };
  }

  authorizeUrl(state: string): string {
    const c = this.cfg();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: c.clientId,
      redirect_uri: c.redirectUri,
      scope: c.scope,
      state,
    });
    const sep = c.authorizeUrl.includes('?') ? '&' : '?';
    return `${c.authorizeUrl}${sep}${params.toString()}`;
  }

  /** Tukar authorization code -> token -> profil pengguna. */
  async handleCallback(code: string): Promise<SsoProfile> {
    const c = this.cfg();
    const tokenRes = await fetch(c.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: c.redirectUri,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }).toString(),
    });
    if (!tokenRes.ok) throw new Error(`SSO token exchange gagal (${tokenRes.status}).`);
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) throw new Error('SSO tidak mengembalikan access_token.');

    const uiRes = await fetch(c.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!uiRes.ok) throw new Error(`SSO userinfo gagal (${uiRes.status}).`);
    const info = (await uiRes.json()) as Record<string, unknown>;

    const sub = String(info.sub ?? info.id ?? '');
    const email = String(info.email ?? info.mail ?? '')
      .toLowerCase()
      .trim();
    const name = String(info.name ?? info.preferred_username ?? email ?? 'Pengguna');
    if (!sub || !email) throw new Error('SSO profil tak lengkap (sub/email).');

    return { sub, email, name, mappedRole: this.mapRole(info) };
  }

  private mapRole(info: Record<string, unknown>): 'penguji' | 'peserta' | 'pending' {
    const c = this.cfg();
    const raw = info[c.roleClaim];
    const values = (Array.isArray(raw) ? raw : [raw]).map((x) =>
      String(x ?? '').toLowerCase(),
    );
    if (values.includes(c.dosenValue)) return 'penguji';
    if (values.includes(c.mahasiswaValue)) return 'peserta';
    return 'pending';
  }
}
