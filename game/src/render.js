// Everything the player sees: golden-hour sky, parallax mountains and hills,
// the runway flats, rings, stars, hazards, the plane itself, the HUD with
// altitude / speed / heading and the lit instrument dials, and the four
// screens (title, play, paused, game over). The playfield is a fixed
// 1280x720 logical area scaled to the window.

import { FIELD, PALETTE, FONT, FONT_MONO, PLANE_X, PLANE, RING, STAR } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Deterministic decoration for a world segment: same segment, same tree. */
function hashSegment(index) {
  const v = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStarShape(ctx, x, y, radius, rotation) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const a = rotation + (i * Math.PI) / 5 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - FIELD.width * scale) / 2, (canvas.height - FIELD.height * scale) / 2);
  }

  function drawSky(distance) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.45, PALETTE.skyMid);
    g.addColorStop(0.75, PALETTE.skyLow);
    g.addColorStop(1, '#ffe9b8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Low sun, right of centre, with a warm glow.
    const sunX = 1020;
    const sunY = 190;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 180);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 180, sunY - 180, 360, 360);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClouds(clouds) {
    ctx.fillStyle = PALETTE.cloud;
    for (const cloud of clouds) {
      const s = cloud.scale;
      // One fill per ellipse: several ellipses in a single path join with
      // straight chords that cancel out and cut a triangular hole in the cloud.
      for (const [dx, dy, rx, ry] of [[0, 0, 62, 20], [-38, 8, 40, 15], [42, 9, 44, 16]]) {
        ctx.beginPath();
        ctx.ellipse(cloud.x + dx * s, cloud.y + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function ridge(distance, parallax, baseY, amp, color, seed) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 16) {
      const wx = x + distance * parallax;
      const y = baseY
        + Math.sin(wx * 0.004 + seed) * amp
        + Math.sin(wx * 0.011 + seed * 2.3) * amp * 0.45;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawTerrain(world, distance) {
    // Rolling ground from the world's own height function.
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 16) {
      ctx.lineTo(x, world.terrainHeightAt(distance + x));
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 560, 0, FIELD.height);
    g.addColorStop(0, PALETTE.hill);
    g.addColorStop(1, PALETTE.groundDark);
    ctx.fillStyle = g;
    ctx.fill();

    // Runway strips on the flat stretches, with centre dashes and threshold bars.
    for (let x = 0; x <= FIELD.width; x += 8) {
      const wx = distance + x;
      if (!world.isRunwayAt(wx)) continue;
      const y = world.terrainHeightAt(wx);
      ctx.fillStyle = PALETTE.runway;
      ctx.fillRect(x, y - 2, 9, 7);
      ctx.fillStyle = PALETTE.runwayLine;
      if (Math.floor(wx / 46) % 2 === 0) ctx.fillRect(x, y + 1, 9, 2);
    }

    // Trees and little houses, one per 90 px segment, skipped on runways.
    for (let seg = Math.floor(distance / 90); seg * 90 < distance + FIELD.width + 90; seg += 1) {
      const wx = seg * 90;
      const sx = wx - distance;
      if (world.isRunwayAt(wx)) continue;
      const h = hashSegment(seg);
      const groundY = world.terrainHeightAt(wx);
      if (h < 0.45) {
        // Pine tree.
        const size = 14 + h * 22;
        ctx.fillStyle = '#2c5e26';
        ctx.beginPath();
        ctx.moveTo(sx, groundY - size);
        ctx.lineTo(sx - size * 0.42, groundY);
        ctx.lineTo(sx + size * 0.42, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(sx - 2, groundY - 2, 4, 4);
      } else if (h < 0.62) {
        // Farmhouse with a lit window.
        ctx.fillStyle = '#f3e2c7';
        ctx.fillRect(sx - 12, groundY - 16, 24, 16);
        ctx.fillStyle = '#a33b2e';
        ctx.beginPath();
        ctx.moveTo(sx - 14, groundY - 16);
        ctx.lineTo(sx, groundY - 26);
        ctx.lineTo(sx + 14, groundY - 16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd34d';
        ctx.fillRect(sx - 3, groundY - 11, 6, 6);
      }
    }
  }

  function drawRing(ring, screenX, time) {
    const pulse = 1 + Math.sin(time * 3 + ring.x * 0.01) * 0.03;
    const r = RING.radius * pulse;
    ctx.save();
    ctx.shadowColor = PALETTE.ringGlow;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(screenX, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#fff7d6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screenX, ring.y, r - 7, 0, Math.PI * 2);
    ctx.stroke();
    // Chevron pointing through the ring.
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(screenX - 8, ring.y - 12);
    ctx.lineTo(screenX + 10, ring.y);
    ctx.lineTo(screenX - 8, ring.y + 12);
    ctx.closePath();
    ctx.fill();
    if (ring.sparkle > 0) {
      ctx.globalAlpha = Math.min(1, ring.sparkle * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(screenX, ring.y, r + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawStarItem(star, screenX, time) {
    const twinkle = 0.75 + Math.sin(time * 4 + star.phase) * 0.25;
    ctx.save();
    ctx.globalAlpha = twinkle;
    ctx.shadowColor = PALETTE.star;
    ctx.shadowBlur = 12;
    ctx.fillStyle = PALETTE.star;
    drawStarShape(ctx, screenX, star.y, STAR.radius, time * 0.8 + star.phase);
    ctx.fill();
    ctx.restore();
  }

  function drawObstacle(ob, screenX, time) {
    if (ob.kind === 'balloon') {
      const wobble = Math.sin(time * 1.2 + ob.phase) * 0.06;
      ctx.save();
      ctx.translate(screenX, ob.y);
      ctx.rotate(wobble);
      ctx.fillStyle = PALETTE.balloon;
      ctx.beginPath();
      ctx.ellipse(0, -8, 30, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.ellipse(0, -8, 12, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5b3a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 22);
      ctx.lineTo(-8, 34);
      ctx.moveTo(14, 22);
      ctx.lineTo(8, 34);
      ctx.stroke();
      ctx.fillStyle = PALETTE.balloonBasket;
      ctx.fillRect(-9, 32, 18, 12);
      ctx.restore();
    } else if (ob.kind === 'bird') {
      const flap = Math.sin(time * 10 + ob.phase) * 0.7;
      ctx.save();
      ctx.translate(screenX, ob.y);
      ctx.strokeStyle = PALETTE.bird;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.quadraticCurveTo(-6, -10 - flap * 10, 0, 0);
      ctx.quadraticCurveTo(6, -10 - flap * 10, 16, 0);
      ctx.stroke();
      ctx.restore();
    } else {
      // Storm cloud with a lightning bolt (one fill per ellipse, as clouds).
      ctx.fillStyle = PALETTE.storm;
      for (const [dx, dy, rx, ry] of [[0, 0, 54, 24], [-30, 8, 34, 18], [32, 9, 36, 18]]) {
        ctx.beginPath();
        ctx.ellipse(screenX + dx, ob.y + dy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(screenX - 4, ob.y + 22);
      ctx.lineTo(screenX + 6, ob.y + 22);
      ctx.lineTo(screenX - 2, ob.y + 38);
      ctx.lineTo(screenX + 6, ob.y + 38);
      ctx.lineTo(screenX - 8, ob.y + 58);
      ctx.lineTo(screenX + 2, ob.y + 36);
      ctx.lineTo(screenX - 6, ob.y + 36);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlane(state, time, planeX) {
    const plane = state.plane;
    const pitch = Math.max(-0.38, Math.min(0.42, plane.vy / 900));
    const blink = state.invulnerable > 0 && Math.floor(time * 12) % 2 === 0;
    ctx.save();
    ctx.translate(planeX, plane.y);
    ctx.rotate(pitch);
    if (blink) ctx.globalAlpha = 0.35;
    // Tail fin and stabiliser.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.lineTo(-38, -22);
    ctx.lineTo(-30, -22);
    ctx.lineTo(-18, -6);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.planeBelly;
    ctx.beginPath();
    ctx.ellipse(2, 5, 32, 6, 0, 0, Math.PI);
    ctx.fill();
    // Wing.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(2, 20);
    ctx.lineTo(-14, 20);
    ctx.closePath();
    ctx.fill();
    // Cockpit glass, lit.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.ellipse(16, -5, 11, 7, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(18, -7, 5, 3, -0.25, 0, Math.PI * 2);
    ctx.fill();
    // Spinning propeller.
    const prop = time * 42;
    ctx.strokeStyle = '#2b2b33';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(38 + Math.cos(prop) * 15, Math.sin(prop) * 15);
    ctx.lineTo(38 - Math.cos(prop) * 15, -Math.sin(prop) * 15);
    ctx.stroke();
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.arc(38, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Exhaust / smoke particles trail behind.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - (PLANE_X - planeX), p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawDial(cx, cy, r, label, value, maxValue, unit, accent) {
    ctx.save();
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Tick marks.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
    const frac = Math.max(0, Math.min(1, value / maxValue));
    const angle = -Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * (r - 6), cy + Math.sin(angle) * (r - 6));
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 17px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(value)), cx, cy + 26);
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${label} ${unit}`, cx, cy - r + 14);
    ctx.restore();
  }

  function drawHud(state, readouts, best) {
    // Top bar: score left, flight data centre, lives right.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, 12, 10, FIELD.width - 24, 52, 10);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `800 24px ${FONT_MONO}`;
    ctx.fillText(`SCORE ${readouts.score}`, 28, 38);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, readouts.score)}`, 28, 56);
    ctx.textAlign = 'center';
    ctx.font = `700 20px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(`ALT ${String(readouts.alt).padStart(5, '0')} FT`, 520, 40);
    ctx.fillText(`SPD ${String(readouts.knots).padStart(3, '0')} KT`, 700, 40);
    ctx.fillText(`HDG ${String(readouts.heading).padStart(3, '0')}°`, 870, 40);
    ctx.textAlign = 'right';
    ctx.font = `700 18px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(`RINGS ${readouts.rings}   LV ${readouts.level}`, FIELD.width - 130, 40);
    // Lives as little plane marks, under the rings count.
    for (let i = 0; i < 3; i += 1) {
      const x = FIELD.width - 100 + i * 26;
      const y = 50;
      ctx.fillStyle = i < readouts.lives ? '#ff5a4e' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.lineTo(x + 3, y);
      ctx.lineTo(x - 1, y + 6);
      ctx.lineTo(x - 6, y + 6);
      ctx.closePath();
      ctx.fill();
    }
    // Combo badge.
    if (readouts.combo >= 2) {
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = `800 18px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`COMBO x${Math.min(readouts.combo, 5)}`, 28, 88);
    }
    // Distance, bottom right.
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `600 14px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(`DIST ${readouts.distanceKm.toFixed(1)} KM`, FIELD.width - 24, FIELD.height - 22);

    // Lit instrument dials, bottom left: altitude and speed.
    drawDial(64, FIELD.height - 66, 44, 'ALT', readouts.alt, 5000, 'FT', '#7fd0ff');
    drawDial(168, FIELD.height - 66, 44, 'SPD', readouts.knots, 500, 'KT', '#ffd34d');
    // Compass strip under the top bar.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, FIELD.width / 2 - 175, 66, 350, 22, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `600 12px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    const headings = ['N 000', 'NE 045', 'E 090', 'SE 135', 'S 180'];
    ctx.fillText(headings.join('  ·  '), FIELD.width / 2, 81);

    // Centre message (level up).
    if (state.messageTimer > 0 && state.message) {
      ctx.globalAlpha = Math.min(1, state.messageTimer);
      ctx.fillStyle = PALETTE.hudAccent;
      ctx.font = `800 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, FIELD.width / 2, 150);
      ctx.globalAlpha = 1;
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 16);
    ctx.stroke();
  }

  function drawTitle(state, best) {
    panel(290, 128, 700, 420);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText('RUNWAY RINGS', 640, 200);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Fly the golden rings. Mind the mountains.', 640, 244);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 17px ${FONT}`;
    const lines = [
      '↑ / W climb      ↓ / S descend      ← → throttle      SPACE boost',
      'Mouse or touch: the plane chases your pointer',
      'Rings +100 × combo   ·   Stars +25   ·   3 lives   ·   Faster every 8 rings',
      'P pause      M mute',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 640, 292 + i * 30));
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO TAKE OFF', 640, 452);
    if (best > 0) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 18px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${best}`, 640, 516);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 14, 28, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(440, 250, 400, 180);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('PAUSED', 640, 320);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `400 18px ${FONT}`;
    ctx.fillText('Press P or Space to keep flying', 640, 360);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(8, 14, 28, 0.5)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(390, 130, 500, 430);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8a7a';
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText('FLIGHT OVER', 640, 196);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 30px ${FONT_MONO}`;
    ctx.fillText(`SCORE  ${state.score}`, 640, 258);
    const rows = [
      `Rings flown  ${state.ringsHit}  (missed ${state.ringsMissed})`,
      `Stars  ${state.stars}     Best combo  x${Math.min(state.bestCombo, 5)}`,
      `Distance  ${(state.distance / 100).toFixed(1)} km     Level ${state.level}`,
      `Best score  ${Math.max(best, state.score)}`,
    ];
    ctx.font = `400 18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    rows.forEach((row, i) => ctx.fillText(row, 640, 306 + i * 32));
    ctx.fillStyle = PALETTE.hudAccent;
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY AGAIN', 640, 500);
  }

  function draw(world, state, screen, best) {
    fit();
    const distance = state.distance;
    const time = state.time;
    drawSky(distance);
    drawClouds(state.clouds);
    ridge(distance, 0.22, 470, 46, PALETTE.mountainFar, 1.7);
    ridge(distance, 0.45, 540, 38, PALETTE.mountainNear, 4.2);
    drawTerrain(world, distance);
    for (const ring of state.rings) {
      const sx = ring.x - distance;
      if (sx > -80 && sx < FIELD.width + 80) drawRing(ring, sx, time);
    }
    for (const star of state.starItems) {
      if (star.taken) continue;
      const sx = star.x - distance;
      if (sx > -40 && sx < FIELD.width + 40) drawStarItem(star, sx, time);
    }
    for (const ob of state.obstacles) {
      const sx = ob.x - distance;
      if (sx > -90 && sx < FIELD.width + 90) drawObstacle(ob, sx, time);
    }
    // On the title screen the plane flies at the left, clear of the panel.
    const planeX = screen === SCREEN_TITLE ? 170 : PLANE_X;
    drawPlane(state, time, planeX);

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state, world.readouts(), best);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);

    // Crash flash.
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 50, ${state.flash * 0.8})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
