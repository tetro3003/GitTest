import stanford.karel.Karel;

public class CheckerboardKarel extends Karel{
	
	public void run(){
		
		 checkers();
		
	}
	
	private void checkers(){
		
		while(frontIsClear()){
			
			putBeeper();
			move();
			move();
		}
		
	}

}
