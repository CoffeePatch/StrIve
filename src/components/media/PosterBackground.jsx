import { useSelector } from "react-redux";
import useMovieTrailer from "../../hooks/media/useMovieTrailer";

const PosterBackground = ({ movieID }) => {
  useMovieTrailer(movieID);

  const trailerVideo = useSelector((store) => store.movies.trailer);

  return (
    <div className="w-full h-screen relative">
      {/* Background Trailer */}
      <iframe
        className="w-full h-full object-cover"
        src={
          trailerVideo?.key
            ? `https://www.youtube.com/embed/${trailerVideo.key}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerVideo.key}&modestbranding=1`
            : ""
        }
        title="Movie Trailer"
        allow="autoplay; encrypted-media"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      ></iframe>

      {/* Dark gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent z-10"></div>
    </div>
  );
};

export default PosterBackground;
