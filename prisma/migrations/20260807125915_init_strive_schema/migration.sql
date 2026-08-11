-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "dashboard_preferences" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_titles" (
    "title_key" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "tmdb_id" INTEGER,
    "imdb_id" TEXT,
    "title" TEXT NOT NULL,
    "original_title" TEXT,
    "overview" TEXT,
    "poster_path" TEXT,
    "backdrop_path" TEXT,
    "release_date" DATE,
    "first_air_date" DATE,
    "last_air_date" DATE,
    "show_status" TEXT,
    "runtime_minutes" INTEGER,
    "number_of_seasons" INTEGER,
    "number_of_episodes" INTEGER,
    "tmdb_score" DECIMAL(4,2),
    "tmdb_votes" INTEGER,
    "imdb_score" DECIMAL(4,2),
    "imdb_votes" INTEGER,
    "popularity" DECIMAL(10,4),
    "genres" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "networks" JSONB,
    "last_fetched_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_titles_pkey" PRIMARY KEY ("title_key")
);

-- CreateTable
CREATE TABLE "catalog_seasons" (
    "title_key" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "title" TEXT,
    "overview" TEXT,
    "poster_path" TEXT,
    "air_date" DATE,
    "episode_count" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_seasons_pkey" PRIMARY KEY ("title_key","season_number")
);

-- CreateTable
CREATE TABLE "catalog_episodes" (
    "title_key" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "absolute_order" INTEGER,
    "title" TEXT,
    "overview" TEXT,
    "still_path" TEXT,
    "air_date" DATE,
    "runtime_minutes" INTEGER,
    "vote_average" DECIMAL(4,2),
    "is_aired" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_episodes_pkey" PRIMARY KEY ("title_key","season_number","episode_number")
);

-- CreateTable
CREATE TABLE "user_library_items" (
    "user_id" TEXT NOT NULL,
    "title_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "user_rating" DECIMAL(3,1),
    "enrichment_status" TEXT NOT NULL DEFAULT 'completed',
    "enrichment_retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_enrichment_attempt" TIMESTAMP(3),
    "next_enrichment_attempt" TIMESTAMP(3),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_watched_at" TIMESTAMP(3),

    CONSTRAINT "user_library_items_pkey" PRIMARY KEY ("user_id","title_key")
);

-- CreateTable
CREATE TABLE "user_episode_states" (
    "user_id" TEXT NOT NULL,
    "title_key" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "absolute_order" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'watched',
    "watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_episode_states_pkey" PRIMARY KEY ("user_id","title_key","season_number","episode_number")
);

-- CreateTable
CREATE TABLE "user_lists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_list_items" (
    "list_id" TEXT NOT NULL,
    "title_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" DECIMAL(10,4) NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_list_items_pkey" PRIMARY KEY ("list_id","title_key")
);

-- AddForeignKey
ALTER TABLE "catalog_seasons" ADD CONSTRAINT "catalog_seasons_title_key_fkey" FOREIGN KEY ("title_key") REFERENCES "catalog_titles"("title_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_episodes" ADD CONSTRAINT "catalog_episodes_title_key_fkey" FOREIGN KEY ("title_key") REFERENCES "catalog_titles"("title_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_episodes" ADD CONSTRAINT "catalog_episodes_title_key_season_number_fkey" FOREIGN KEY ("title_key", "season_number") REFERENCES "catalog_seasons"("title_key", "season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_library_items" ADD CONSTRAINT "user_library_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_library_items" ADD CONSTRAINT "user_library_items_title_key_fkey" FOREIGN KEY ("title_key") REFERENCES "catalog_titles"("title_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_states" ADD CONSTRAINT "user_episode_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_states" ADD CONSTRAINT "user_episode_states_title_key_fkey" FOREIGN KEY ("title_key") REFERENCES "catalog_titles"("title_key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_states" ADD CONSTRAINT "user_episode_states_title_key_season_number_fkey" FOREIGN KEY ("title_key", "season_number") REFERENCES "catalog_seasons"("title_key", "season_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_episode_states" ADD CONSTRAINT "user_episode_states_title_key_season_number_episode_number_fkey" FOREIGN KEY ("title_key", "season_number", "episode_number") REFERENCES "catalog_episodes"("title_key", "season_number", "episode_number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_lists" ADD CONSTRAINT "user_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "user_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_list_items" ADD CONSTRAINT "user_list_items_title_key_fkey" FOREIGN KEY ("title_key") REFERENCES "catalog_titles"("title_key") ON DELETE CASCADE ON UPDATE CASCADE;


