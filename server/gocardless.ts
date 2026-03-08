const BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiresAt: number = 0;
let refreshExpiresAt: number = 0;

function getCredentials() {
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;
  if (!secretId || !secretKey) {
    throw new Error("Brak kluczy GoCardless. Ustaw GOCARDLESS_SECRET_ID i GOCARDLESS_SECRET_KEY.");
  }
  return { secretId, secretKey };
}

async function fetchNewToken(): Promise<void> {
  const { secretId, secretKey } = getCredentials();
  const res = await fetch(`${BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless token error: ${res.status} ${err}`);
  }
  const data = await res.json();
  accessToken = data.access;
  refreshToken = data.refresh;
  tokenExpiresAt = Date.now() + (data.access_expires - 60) * 1000;
  refreshExpiresAt = Date.now() + (data.refresh_expires - 60) * 1000;
}

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken || Date.now() >= refreshExpiresAt) {
    return fetchNewToken();
  }
  const res = await fetch(`${BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!res.ok) {
    return fetchNewToken();
  }
  const data = await res.json();
  accessToken = data.access;
  tokenExpiresAt = Date.now() + (data.access_expires - 60) * 1000;
}

async function getAccessToken(): Promise<string> {
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    if (refreshToken && Date.now() < refreshExpiresAt) {
      await refreshAccessToken();
    } else {
      await fetchNewToken();
    }
  }
  return accessToken!;
}

async function gcFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GoCardless API error ${res.status}: ${err}`);
  }
  return res.json();
}

export interface GCInstitution {
  id: string;
  name: string;
  bic: string;
  transaction_total_days: string;
  countries: string[];
  logo: string;
}

export interface GCRequisition {
  id: string;
  status: string;
  institution_id: string;
  link: string;
  accounts: string[];
  reference: string;
}

export interface GCAccountDetails {
  iban: string;
  currency: string;
  ownerName: string;
  name: string;
  product: string;
}

export interface GCBalance {
  balanceAmount: { amount: string; currency: string };
  balanceType: string;
  referenceDate: string;
}

export interface GCTransaction {
  transactionId?: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  creditorName?: string;
  debtorName?: string;
  creditorAccount?: { iban?: string };
  debtorAccount?: { iban?: string };
  additionalInformation?: string;
}

export async function listInstitutions(country: string = "pl"): Promise<GCInstitution[]> {
  return gcFetch(`/institutions/?country=${country}`);
}

export async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  reference?: string
): Promise<GCRequisition> {
  return gcFetch("/requisitions/", {
    method: "POST",
    body: JSON.stringify({
      institution_id: institutionId,
      redirect: redirectUrl,
      reference: reference || `bf-${Date.now()}`,
    }),
  });
}

export async function getRequisition(id: string): Promise<GCRequisition> {
  return gcFetch(`/requisitions/${id}/`);
}

export async function deleteRequisition(id: string): Promise<void> {
  await getAccessToken();
  const token = accessToken!;
  await fetch(`${BASE_URL}/requisitions/${id}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAccountDetails(accountId: string): Promise<GCAccountDetails> {
  const data = await gcFetch(`/accounts/${accountId}/details/`);
  return data.account;
}

export async function getAccountBalances(accountId: string): Promise<GCBalance[]> {
  const data = await gcFetch(`/accounts/${accountId}/balances/`);
  return data.balances;
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ booked: GCTransaction[]; pending: GCTransaction[] }> {
  let path = `/accounts/${accountId}/transactions/`;
  const params: string[] = [];
  if (dateFrom) params.push(`date_from=${dateFrom}`);
  if (dateTo) params.push(`date_to=${dateTo}`);
  if (params.length) path += `?${params.join("&")}`;
  const data = await gcFetch(path);
  return data.transactions;
}

export function isConfigured(): boolean {
  return !!(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY);
}

export function getTransactionDescription(tx: GCTransaction): string {
  if (tx.remittanceInformationUnstructured) return tx.remittanceInformationUnstructured;
  if (tx.remittanceInformationUnstructuredArray?.length) return tx.remittanceInformationUnstructuredArray.join(" ");
  if (tx.additionalInformation) return tx.additionalInformation;
  return tx.creditorName || tx.debtorName || "Brak opisu";
}

export function getTransactionCounterparty(tx: GCTransaction): string {
  return tx.creditorName || tx.debtorName || "";
}
