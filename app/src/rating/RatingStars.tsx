import { useId } from 'react';
import { formatRating, starFills } from './rating';
import './rating.css';

const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';
/** Odwrócony łuk: skrajne gwiazdki wyżej, środkowa najniżej (zatwierdzona makieta 13.11.2026). */
export const ARC_OFFSETS = [0, 5, 8, 5, 0] as const;
const ROTATION = [-12, -6, 0, 6, 12] as const;

/** Pięć gwiazdek pod nazwą zawodnika: bez opisu, wypełnienie proporcjonalne (z połówkami); 7/10 = 3,5. */
export default function RatingStars({ rating, size = 28 }: { rating: number; size?: number }) {
  const uid = useId();
  const fills = starFills(rating);
  const step = size * 1.05;
  const width = step * 5;
  const height = size + ARC_OFFSETS[2] * (size / 24);
  return (
    <svg className="slm-rating-stars" role="img" aria-label={`Ocena ${formatRating(rating)} na 10`} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6c9" /><stop offset=".45" stopColor="#f2c94c" /><stop offset="1" stopColor="#b47a16" />
        </linearGradient>
      </defs>
      {fills.map((fill, i) => {
        const x = i * step, y = ARC_OFFSETS[i] * (size / 24), scale = size / 24, clip = `${uid}-s${i}`;
        return (
          <g key={i} data-fill={fill} transform={`translate(${x} ${y}) rotate(${ROTATION[i]} ${size / 2} ${size / 2}) scale(${scale})`}>
            <clipPath id={clip}><rect x="0" y="0" width={24 * fill} height="24" /></clipPath>
            <path className="slm-rating-star-bg" d={STAR} />
            <path className="slm-rating-star-fill" d={STAR} clipPath={`url(#${clip})`} fill={`url(#${uid}-gold)`} />
          </g>
        );
      })}
    </svg>
  );
}
