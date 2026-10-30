// Mounts are in the game's metre-scale chassis coordinates, not source GLB units.
// Forward is always the driving direction, even for models authored facing -X.
export const DRIVING_CAMERAS = Object.freeze(['chase', 'cockpit', 'halo', 'frontwing', 'rear']);

export function carBodyFrame(team, x, groundY, z, heading, suspension) {
  const sign = team === 'mclaren' || team === 'redbull' ? 1 : -1;
  const originY = team === 'mclaren' ? .577 : team === 'redbull' ? .075 : .5;
  return {
    team, x, y: groundY + originY, z, originY, sign,
    heading: heading + (sign < 0 ? Math.PI : 0),
    pitch: suspension.pitch * sign,
    roll: suspension.roll * sign,
  };
}

// Match carVs exactly: pitch about model Z, roll about model X, then heading.
export function bodyDirection(frame, vector) {
  const [x, y, z] = vector;
  const cp = Math.cos(frame.pitch), sp = Math.sin(frame.pitch);
  const cr = Math.cos(frame.roll), sr = Math.sin(frame.roll);
  const px = cp * x - sp * y, py = sp * x + cp * y;
  const ry = cr * py - sr * z, rz = sr * py + cr * z;
  const ch = Math.cos(frame.heading), sh = Math.sin(frame.heading);
  return [ch * px - sh * rz, ry, sh * px + ch * rz];
}

export function cockpitCamera(frame, mode = 'cockpit') {
  if (mode !== 'halo' && !['redbull', 'ferrari'].includes(frame.team)) return null;
  // Ahead of the rear roll hoop and below the Halo: the existing steering
  // wheel/dashboard, nose and front tyres remain in the driver's field of view.
  const mount = mode === 'halo'
    ? { forward: -.35, height: 1.12, lookDown: 8, fov: 75 }
    : { forward: -.10, height: .72, lookDown: 2, fov: 70 };
  const offset = bodyDirection(frame, [mount.forward * frame.sign, mount.height - frame.originY, 0]);
  const eye = [frame.x + offset[0], frame.y + offset[1], frame.z + offset[2]];
  const angle = mount.lookDown * Math.PI / 180;
  const forward = bodyDirection(frame, [Math.cos(angle) * frame.sign, -Math.sin(angle), 0]);
  return {
    eye,
    center: eye.map((value, i) => value + forward[i] * 22),
    up: bodyDirection(frame, [0, 1, 0]),
    fov: mount.fov,
    near: .05,
  };
}
