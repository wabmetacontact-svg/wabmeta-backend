-- Meta PAUSED aur REJECTED ko alag rakhta hai. Pehle dono REJECTED map hote
-- the, isliye user ko chalne layak template mara hua dikhta tha.
-- PAUSED quality gir jane par lagta hai aur apne aap wapas aa sakta hai.
ALTER TYPE "TemplateStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
