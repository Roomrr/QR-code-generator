export const now = () => new Date().toISOString();
export const DAY = 86400000;
export function accessFor(user) {
  const verified = !!user.verified_at;
  return {
    allowed: verified && user.status === "active",
    type: !verified
      ? "unverified"
      : user.status !== "active"
        ? user.status
        : "free",
  };
}
export const safeUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  verified: !!u.verified_at,
  role: u.role,
  status: u.status,
  access: accessFor(u),
});
export function superadmin(req, res, next) {
  if (req.user.role !== "superadmin")
    return res
      .status(403)
      .json({ error: "Super administrator access is required." });
  next();
}
