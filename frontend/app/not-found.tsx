export default function NotFound() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted-foreground">
          The page you are looking for does not exist.
        </p>
      </div>
    </div>
  );
}
