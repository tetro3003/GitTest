import stanford.karel.Karel;

public class NinoMagaria extends Karel{
	public void run(){
		while(frontIsClear()){
			while(noBeepersPresent()){
				putBeeper();
			}
			move();
		}
		
		
	}
	

}
