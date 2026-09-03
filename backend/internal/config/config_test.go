package config

import (
	"reflect"
	"testing"
)

func TestSplitCSVTrimsAndDropsEmptyValues(t *testing.T) {
	t.Parallel()
	got := splitCSV(" lacidigital://oauth/callback, ,https://mobile.example/callback ")
	want := []string{"lacidigital://oauth/callback", "https://mobile.example/callback"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("splitCSV() = %#v, want %#v", got, want)
	}
}
